import { and, eq, ilike, or } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseQuery, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { tickets, ticketCategories } from '~~/server/db/schema'
export default api(async (e) => {
  const { event } = await requireEvent(e, uuidParam(e, 'eventId'), 'scan')
  const { q } = parseQuery(e, z.object({ q: z.string().trim().min(2).max(60) }))
  const like = `%${q.replace(/[%_]/g, '')}%`
  return useDb().select({ ref: tickets.ref, holder: tickets.holderName, status: tickets.status, category: ticketCategories.name, usedAt: tickets.usedAt }).from(tickets).innerJoin(ticketCategories, eq(ticketCategories.id, tickets.categoryId)).where(and(eq(tickets.eventId, event.id), or(ilike(tickets.holderName, like), ilike(tickets.ref, like)))).limit(20)
})
