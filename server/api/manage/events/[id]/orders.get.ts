import { desc, eq, sql } from 'drizzle-orm'
import { getQuery, setHeader } from 'h3'
import { toCsv } from '~~/server/services/csv'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { orders, users, userProfiles } from '~~/server/db/schema'
export default api(async (e) => {
  const { event } = await requireEvent(e, uuidParam(e, 'id'), 'sales:read')
  const rows = await useDb().select({ id: orders.id, status: orders.status, channel: orders.channel, buyerName: orders.buyerName, buyerEmail: orders.buyerEmail, total: orders.total, platformFee: orders.platformFee, organizerNet: orders.organizerNet, paymentMethod: orders.paymentMethod, campaign: orders.campaign, isDemo: orders.isDemo, createdAt: orders.createdAt, paidAt: orders.paidAt, seller: userProfiles.fullName,
    tickets: sql<number>`(select count(*) from tickets t where t.order_id = ${orders.id})::int` }).from(orders).leftJoin(users, eq(users.id, orders.sellerId)).leftJoin(userProfiles, eq(userProfiles.userId, users.id)).where(eq(orders.eventId, event.id)).orderBy(desc(orders.createdAt)).limit(2000)
  if (getQuery(e).format === 'csv') { setHeader(e, 'Content-Type', 'text/csv; charset=utf-8'); setHeader(e, 'Content-Disposition', `attachment; filename="ventes-${event.slug}.csv"`); return toCsv(['Commande', 'Canal', 'Statut', 'Acheteur', 'E-mail', 'Billets', 'Total', 'Commission TYPS', 'Net organisateur', 'Paiement', 'Campagne', 'Date'], rows.map((r) => [r.id, r.channel, r.status, r.buyerName, r.buyerEmail, r.tickets, r.total, r.platformFee, r.organizerNet, r.paymentMethod, r.campaign, r.paidAt?.toISOString()])) }
  return rows
})
