import { desc, eq } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { checkIns, tickets, ticketCategories, users, userProfiles } from '~~/server/db/schema'
import { checkInCount } from '~~/server/services/scan'
export default api(async (e) => {
  const { event } = await requireEvent(e, uuidParam(e, 'eventId'), 'scan'); const db = useDb()
  const items = await db.select({ id: checkIns.id, result: checkIns.result, gate: checkIns.gate, at: checkIns.scannedAt, source: checkIns.source, conflict: checkIns.conflict, ref: tickets.ref, category: ticketCategories.name, agent: userProfiles.fullName })
    .from(checkIns).leftJoin(tickets, eq(tickets.id, checkIns.ticketId)).leftJoin(ticketCategories, eq(ticketCategories.id, tickets.categoryId)).leftJoin(users, eq(users.id, checkIns.agentId)).leftJoin(userProfiles, eq(userProfiles.userId, users.id)).where(eq(checkIns.eventId, event.id)).orderBy(desc(checkIns.scannedAt)).limit(100)
  return { items, entries: await checkInCount(db, event.id), capacity: event.capacity, offlineEnabled: event.offlineEnabled, title: event.title }
})
