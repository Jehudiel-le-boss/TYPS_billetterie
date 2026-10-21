import { and, eq, isNull } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireTemplate } from '~~/server/utils/templates'
import { ticketTemplates } from '~~/server/db/schema'
import { audit } from '~~/server/utils/audit'
import { fail } from '~~/server/utils/errors'

export default api(async (e) => {
  const { template, user } = await requireTemplate(e, uuidParam(e, 'id'), 'template:write')
  const db = useDb()
  const [archived] = await db.update(ticketTemplates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(ticketTemplates.id, template.id), isNull(ticketTemplates.deletedAt)))
    .returning({ id: ticketTemplates.id })
  if (!archived) return fail(409, 'Ce modèle a déjà été supprimé.', 'template_already_archived')
  await audit(db, {
    actorId: user.id,
    organizationId: template.organizationId,
    action: 'template.archive',
    entityType: 'template',
    entityId: template.id,
    meta: { name: template.name }
  })
  return { deleted: true }
})
