import { api, parseBody, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { physicalSaleSchema } from '~~/shared/validation'
import { getFeeConfig } from '~~/server/services/settings'
import { createPhysicalSale } from '~~/server/services/checkout'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'sales:create_physical')
  limit(e, 'door-sale', 120, 60_000, user.id)
  const b = await parseBody(e, physicalSaleSchema)
  const db = useDb()
  const r = await createPhysicalSale(db, { ...b, eventId: event.id, sellerId: user.id }, await getFeeConfig(db))
  await audit(db, { actorId: user.id, organizationId: event.organizationId, action: 'sale.physical', entityType: 'order', entityId: r.order.id, meta: { method: b.paymentMethod, total: r.order.total, tickets: r.tickets.length } })
  return { orderId: r.order.id, k: r.accessToken, total: r.order.total, change: b.amountReceived - r.order.total, currency: r.order.currency, tickets: r.tickets.map((t) => ({ id: t.id, ref: t.ref })) }
})
