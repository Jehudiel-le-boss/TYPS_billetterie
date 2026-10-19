import { and, eq, inArray, isNull, gte, or, sql } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { events, eventStaff, organizationMembers, eventLocations } from '~~/server/db/schema'
// Événements que l'utilisateur peut contrôler : affectations event_staff OU rôle d'organisation autorisé à scanner.
export default api(async (e) => {
  const u = await requireUser(e); const db = useDb()
  const orgIds = (await db.select({ id: organizationMembers.organizationId }).from(organizationMembers).where(and(eq(organizationMembers.userId, u.id), isNull(organizationMembers.revokedAt), inArray(organizationMembers.role, ['owner', 'manager', 'seller', 'agent'])))).map((r) => r.id)
  const staffIds = (await db.select({ id: eventStaff.eventId }).from(eventStaff).where(and(eq(eventStaff.userId, u.id), isNull(eventStaff.revokedAt), eq(eventStaff.canScan, true)))).map((r) => r.id)
  const since = new Date(Date.now() - 2 * 86400_000)
  const cond = [staffIds.length ? inArray(events.id, staffIds) : sql`false`, orgIds.length ? inArray(events.organizationId, orgIds) : sql`false`]
  return db.select({ id: events.id, title: events.title, startsAt: events.startsAt, status: events.status, offlineEnabled: events.offlineEnabled, venue: eventLocations.venueName }).from(events).leftJoin(eventLocations, eq(eventLocations.eventId, events.id))
    .where(and(isNull(events.deletedAt), inArray(events.status, ['published', 'closed']), gte(sql`coalesce(${events.endsAt}, ${events.startsAt})`, since), or(...cond))).orderBy(events.startsAt).limit(50)
})
