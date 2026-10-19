import { readMultipartFormData } from 'h3'
import { api, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { ticketTemplateAssets } from '~~/server/db/schema'
import { putObject, sniffImage, signedUrl } from '~~/server/services/storage'
import { randomToken } from '~~/server/utils/crypto'
import { fail } from '~~/server/utils/errors'
const MAX = 6 * 1024 * 1024
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
  if (file.data.length > MAX) return fail(413, 'Fichier trop volumineux (6 Mo maximum)', 'too_large')
  const img = sniffImage(file.data)
  if (!img) return fail(415, 'Format refusé : PNG ou JPEG uniquement (les PDF sont convertis dans l’éditeur)', 'bad_type')
  if (img.width > 6000 || img.height > 6000) return fail(422, 'Image trop grande (6000 px maximum)', 'too_large')
  const key = `org/${orgId}/${kind}/${randomToken(18)}.${img.mime === 'image/png' ? 'png' : 'jpg'}`
  await putObject(key, file.data, img.mime)
  const [a] = await useDb().insert(ticketTemplateAssets).values({ organizationId: orgId, kind, storageKey: key, mime: img.mime, bytes: file.data.length, width: img.width, height: img.height, createdBy: user.id }).returning()
  return { id: a!.id, key, width: img.width, height: img.height, url: await signedUrl(key, 3600) }
})
