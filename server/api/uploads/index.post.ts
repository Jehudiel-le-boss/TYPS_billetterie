import { readMultipartFormData } from 'h3'
import { api, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { ticketTemplateAssets } from '~~/server/db/schema'
import { deleteObject, putObject, sniffImage, signedUrl } from '~~/server/services/storage'
import { randomToken } from '~~/server/utils/crypto'
import { fail } from '~~/server/utils/errors'
import { eq } from 'drizzle-orm'
const MAX = 4 * 1024 * 1024
// Téléversement validé côté serveur : taille, type RÉEL (octets magiques PNG/JPEG), nom généré — jamais le nom du client. SVG refusé (XSS).
export default api(async (e) => {
  const parts = await readMultipartFormData(e)
  if (!parts) return fail(400, 'Formulaire attendu', 'validation')
  const field = (n: string) => parts.find((p) => p.name === n)?.data.toString('utf8')
  const orgId = field('orgId') ?? '', kind = field('kind') ?? 'image'
  if (!/^[0-9a-f-]{36}$/i.test(orgId) || !['background', 'logo', 'image', 'poster', 'gallery'].includes(kind)) return fail(422, 'Paramètres invalides', 'validation')
  const { user } = await requireOrg(e, orgId, kind === 'poster' || kind === 'gallery' ? 'event:write' : 'template:write'); limit(e, 'upload', 40, 600_000, user.id)
  const file = parts.find((p) => p.name === 'file' && p.filename)
  if (!file) return fail(400, 'Fichier manquant', 'validation')
  if (file.data.length > MAX) return fail(413, 'Fichier trop volumineux après réception (4 Mo maximum). Réessaie avec une image moins lourde.', 'too_large')
  const img = sniffImage(file.data)
  if (!img) return fail(415, 'Format refusé : PNG ou JPEG uniquement (les PDF sont convertis dans l’éditeur)', 'bad_type')
  if (img.width < 1 || img.height < 1) return fail(422, 'Dimensions d’image invalides.', 'bad_image')
  if (img.width > 6000 || img.height > 6000 || img.width * img.height > 24_000_000) return fail(422, 'Image trop grande (6000 px par côté et 24 mégapixels maximum)', 'too_large')
  const key = `org/${orgId}/${kind}/${randomToken(18)}.${img.mime === 'image/png' ? 'png' : 'jpg'}`
  let storageKey: string
  try {
    storageKey = await putObject(key, file.data, img.mime)
  } catch (error) {
    console.error('[upload.storage] Provider rejected upload', { errorName: error instanceof Error ? error.name : 'UnknownError' })
    return fail(503, 'Le stockage des images est indisponible. Réessaie plus tard ou contacte l’assistance si le problème persiste.', 'storage_unavailable')
  }

  const db = useDb()
  let asset: typeof ticketTemplateAssets.$inferSelect | undefined
  try {
    const [insertedAsset] = await db.insert(ticketTemplateAssets).values({
      organizationId: orgId,
      kind,
      storageKey,
      mime: img.mime,
      bytes: file.data.length,
      width: img.width,
      height: img.height,
      createdBy: user.id
    }).returning()
    asset = insertedAsset
    if (!asset) throw new Error('Asset insert returned no row')
  } catch (error) {
    let objectRemoved = true
    try {
      await deleteObject(storageKey)
    } catch (cleanupError) {
      objectRemoved = false
      console.error('[upload.cleanup] Could not remove unregistered object', { errorName: cleanupError instanceof Error ? cleanupError.name : 'UnknownError' })
    }
    console.error('[upload.database] Could not register uploaded image', { errorName: error instanceof Error ? error.name : 'UnknownError' })
    return fail(500, objectRemoved
      ? 'L’image a été téléversée mais son enregistrement a échoué. Réessaie.'
      : 'L’enregistrement de l’image a échoué et le nettoyage du fichier est incomplet. Contacte l’assistance.',
    'asset_record_failed')
  }

  try {
    return { id: asset.id, key: storageKey, width: img.width, height: img.height, url: await signedUrl(storageKey, 3600) }
  } catch (error) {
    let recordRemoved = false
    try {
      await db.delete(ticketTemplateAssets).where(eq(ticketTemplateAssets.id, asset.id))
      recordRemoved = true
    } catch (cleanupError) {
      console.error('[upload.cleanup] Could not remove failed asset record', { errorName: cleanupError instanceof Error ? cleanupError.name : 'UnknownError' })
    }
    let objectRemoved = true
    try {
      await deleteObject(storageKey)
    } catch (cleanupError) {
      objectRemoved = false
      console.error('[upload.cleanup] Could not remove asset after URL failure', { errorName: cleanupError instanceof Error ? cleanupError.name : 'UnknownError' })
    }
    console.error('[upload.url] Could not create signed asset URL', { errorName: error instanceof Error ? error.name : 'UnknownError' })
    const missingSigningSecret = error instanceof Error && error.message.includes('SESSION_SECRET')
    return fail(503, objectRemoved && recordRemoved
      ? missingSigningSecret
        ? 'Configuration serveur incomplète : SESSION_SECRET doit être définie en production (16 caractères minimum).'
        : 'Le lien de lecture de l’image n’a pas pu être créé. Réessaie.'
      : 'La création du lien de l’image a échoué et le nettoyage du fichier est incomplet. Contacte l’assistance.',
    'asset_url_failed')
  }
})
