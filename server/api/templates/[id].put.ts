import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireTemplate } from '~~/server/utils/templates'
import { ticketTemplates } from '~~/server/db/schema'
import { sanitizeLayout } from '~~/shared/template'
import { fail } from '~~/server/utils/errors'
// Enregistrement automatique du brouillon (le layout reçu est toujours re-validé côté serveur).
export default api(async (e) => {
  const { template, user } = await requireTemplate(e, uuidParam(e, 'id'), 'template:write'); limit(e, 'tpl-save', 120, 60_000, user.id)
  const b = await parseBody(e, z.object({ name: z.string().trim().min(2).max(80).optional(), layout: z.any() }))
  let layout
  try { layout = sanitizeLayout(b.layout) } catch (err) { return fail(422, (err as Error).message, 'validation') }
  await useDb().update(ticketTemplates).set({ draftLayout: layout, ...(b.name && { name: b.name }), updatedAt: new Date() }).where(eq(ticketTemplates.id, template.id))
  return { savedAt: new Date() }
})
