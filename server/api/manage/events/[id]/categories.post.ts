import { and, eq, isNull } from 'drizzle-orm'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { ticketCategories, ticketTemplates } from '~~/server/db/schema'
import { categorySchema } from '~~/shared/validation'
import { audit } from '~~/server/utils/audit'
import { fail } from '~~/server/utils/errors'
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'event:write')
  const b = await parseBody(e, categorySchema)
  if (b.kind === 'custom' && !b.customType?.trim()) return fail(422, 'Indique le nom du type personnalisé (par exemple Premium ou Accès terrasse).', 'custom_ticket_type_required')
  if (b.templateId) {
    const [template] = await useDb().select({ id: ticketTemplates.id }).from(ticketTemplates)
      .where(and(eq(ticketTemplates.id, b.templateId), eq(ticketTemplates.organizationId, event.organizationId), isNull(ticketTemplates.deletedAt))).limit(1)
    if (!template) return fail(400, 'Choisis un modèle de billet actif de cette organisation.', 'invalid_ticket_template')
  }
  const [c] = await useDb().insert(ticketCategories).values({ ...b, eventId: event.id, price: b.kind === 'free' ? 0 : b.price }).returning()
  await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: 'category.create', entityType: 'category', entityId: c!.id })
  return c
})
