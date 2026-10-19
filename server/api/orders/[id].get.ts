import { eq, asc } from 'drizzle-orm'
import { api, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrderAccess } from '~~/server/utils/orders'
import { events, eventLocations, tickets, ticketCategories, payments } from '~~/server/db/schema'
import { verifyAndSettle } from '~~/server/services/payments'

export default api(async (e) => {
  const id = uuidParam(e, 'id')
  let { order } = await requireOrderAccess(e, id)
  const db = useDb()
  let verification: string | undefined
  if (order.status === 'pending' && order.total > 0 && !order.isDemo) {
    limit(e, 'order-refresh', 40, 300_000, id)
    try { verification = (await verifyAndSettle(db, id)).state } catch { verification = 'unverifiable' }
    order = (await requireOrderAccess(e, id)).order
  }
  const [ev] = await db.select({ e: events, loc: eventLocations }).from(events).leftJoin(eventLocations, eq(eventLocations.eventId, events.id)).where(eq(events.id, order.eventId)).limit(1)
  const [pay] = await db.select({ status: payments.status, provider: payments.provider }).from(payments).where(eq(payments.orderId, id)).limit(1)
  const list = await db.select({ id: tickets.id, ref: tickets.ref, status: tickets.status, holderName: tickets.holderName, category: ticketCategories.name, vip: ticketCategories.vip }).from(tickets).innerJoin(ticketCategories, eq(ticketCategories.id, tickets.categoryId)).where(eq(tickets.orderId, id)).orderBy(asc(tickets.ref))
  return {
    id: order.id, status: order.status, channel: order.channel, total: order.total, subtotal: order.subtotal, discount: order.discount, buyerFees: order.buyerFees, currency: order.currency, isDemo: order.isDemo, expiresAt: order.expiresAt, paidAt: order.paidAt,
    buyerName: order.buyerName, buyerEmail: order.buyerEmail, payment: pay ?? null, verification, tickets: order.status === 'paid' ? list : [],
    event: ev ? { id: ev.e.id, slug: ev.e.slug, title: ev.e.title, startsAt: ev.e.startsAt, themeId: ev.e.themeId, transfersEnabled: ev.e.transfersEnabled, venue: ev.loc?.venueName ?? '', city: ev.loc?.city ?? '' } : null
  }
})
