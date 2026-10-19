import { and, asc, eq } from 'drizzle-orm'
import { getQuery, setHeader } from 'h3'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { tickets, ticketCategories } from '~~/server/db/schema'
import { toCsv } from '~~/server/services/csv'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'sales:read')
  const rows = await useDb().select({ id: tickets.id, ref: tickets.ref, holder: tickets.holderName, email: tickets.holderEmail, status: tickets.status, source: tickets.source, category: ticketCategories.name, price: tickets.pricePaid, usedAt: tickets.usedAt, issuedAt: tickets.issuedAt })
    .from(tickets).innerJoin(ticketCategories, eq(ticketCategories.id, tickets.categoryId)).where(and(eq(tickets.eventId, event.id))).orderBy(asc(tickets.holderName)).limit(5000)
  if (getQuery(e).format === 'csv') {
    await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: 'export.attendees', entityType: 'event', entityId: event.id, meta: { rows: rows.length } })
    setHeader(e, 'Content-Type', 'text/csv; charset=utf-8'); setHeader(e, 'Content-Disposition', `attachment; filename="participants-${event.slug}.csv"`)
    return toCsv(['Référence', 'Nom', 'E-mail', 'Catégorie', 'Statut', 'Canal', 'Prix payé', 'Entré à'], rows.map((r) => [r.ref, r.holder, r.email, r.category, r.status, r.source, r.price, r.usedAt?.toISOString()]))
  }
  return rows
})
