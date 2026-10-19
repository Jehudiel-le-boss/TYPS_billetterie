import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { orders } from '~~/server/db/schema'
import { cancelPhysicalOrder } from '~~/server/services/checkout'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const id = uuidParam(e, 'id')
  const [o] = await useDb().select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!o) return fail(404, 'Vente introuvable', 'not_found')
  const { user, event } = await requireEvent(e, o.eventId, 'sales:cancel')
  const { reason } = await parseBody(e, z.object({ reason: z.string().trim().min(3).max(200) }))
  await cancelPhysicalOrder(useDb(), id, user.id, reason)
  await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: 'sale.physical.cancel', entityType: 'order', entityId: id, meta: { reason } })
  return { ok: true }
})
