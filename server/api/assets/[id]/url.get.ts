import { eq } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { ticketTemplateAssets } from '~~/server/db/schema'
import { signedUrl } from '~~/server/services/storage'
import { fail } from '~~/server/utils/errors'
export default api(async (e) => {
  const [a] = await useDb().select().from(ticketTemplateAssets).where(eq(ticketTemplateAssets.id, uuidParam(e, 'id'))).limit(1)
  if (!a) return fail(404, 'Fichier introuvable', 'not_found')
  await requireOrg(e, a.organizationId, 'event:read')
  return { url: await signedUrl(a.storageKey, 900) }
})
