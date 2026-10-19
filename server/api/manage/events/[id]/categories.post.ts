import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { ticketCategories } from '~~/server/db/schema'
import { categorySchema } from '~~/shared/validation'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'event:write')
  const b = await parseBody(e, categorySchema)
  const [c] = await useDb().insert(ticketCategories).values({ ...b, eventId: event.id, price: b.kind === 'free' ? 0 : b.price }).returning()
  await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: 'category.create', entityType: 'category', entityId: c!.id })
  return c
})
