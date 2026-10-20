import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { api, limit, parseQuery } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { fail } from '~~/server/utils/errors'
import { events, orders, tickets } from '~~/server/db/schema'

const querySchema = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) })
const PAGE_SIZE = 25

export default api(async (e) => {
  const user = await requireUser(e)
  if (!user.emailVerified) return fail(403, 'Vérifie ton adresse e-mail pour retrouver tes achats', 'email_unverified')
  limit(e, 'my-orders', 60, 60_000, user.id)
  const { page } = parseQuery(e, querySchema)
  const rows = await useDb().select({
    id: orders.id,
    status: orders.status,
    total: orders.total,
    currency: orders.currency,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
    eventTitle: events.title,
    startsAt: events.startsAt,
    ticketCount: sql<number>`count(${tickets.id})::int`
  }).from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .leftJoin(tickets, eq(tickets.orderId, orders.id))
    .where(and(eq(orders.buyerEmail, user.email.toLowerCase()), eq(orders.channel, 'online')))
    .groupBy(orders.id, events.id)
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE)
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, page }
})
