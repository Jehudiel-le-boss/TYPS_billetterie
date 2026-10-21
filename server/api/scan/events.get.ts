import { and, eq, inArray, isNull, gte, or, sql } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { events, eventStaff, organizationMembers, eventLocations } from '~~/server/db/schema'
// Événements que l'utilisateur peut contrôler : affectations event_staff OU rôle d'organisation autorisé à scanner.
export default api(async (e) => {
  const u = await requireUser(e); const db = useDb()
  const memberships = await db.select({ id: organizationMembers.organizationId, role: organizationMembers.role }).from(organizationMembers).where(and(eq(organizationMembers.userId, u.id), isNull(organizationMembers.revokedAt), inArray(organizationMembers.role, ['owner', 'manager', 'seller', 'agent'])))
  const orgIds = memberships.map((r) => r.id)
  const orgRoles = new Map(memberships.map((r) => [r.id, r.role]))
  const assignments = await db.select({ eventId: eventStaff.eventId, canScan: eventStaff.canScan, canSell: eventStaff.canSell }).from(eventStaff).where(and(eq(eventStaff.userId, u.id), isNull(eventStaff.revokedAt), or(eq(eventStaff.canScan, true), eq(eventStaff.canSell, true))))
  const assignmentByEvent = new Map(assignments.map((r) => [r.eventId, r]))
  const staffIds = assignments.map((r) => r.eventId)
  const since = new Date(Date.now() - 2 * 86400_000)
  const cond = [staffIds.length ? inArray(events.id, staffIds) : sql`false`, orgIds.length ? inArray(events.organizationId, orgIds) : sql`false`]
  const rows = await db.select({ id: events.id, organizationId: events.organizationId, title: events.title, startsAt: events.startsAt, status: events.status, offlineEnabled: events.offlineEnabled, venue: eventLocations.venueName }).from(events).leftJoin(eventLocations, eq(eventLocations.eventId, events.id))
    .where(and(isNull(events.deletedAt), inArray(events.status, ['published', 'closed']), gte(sql`coalesce(${events.endsAt}, ${events.startsAt})`, since), or(...cond))).orderBy(events.startsAt).limit(50)
  return rows.map((event) => {
    const assignment = assignmentByEvent.get(event.id)
    const role = orgRoles.get(event.organizationId)
    const orgCanScan = ['owner', 'manager', 'seller', 'agent'].includes(role ?? '')
    const orgCanSell = ['owner', 'manager', 'seller'].includes(role ?? '')
    return { id: event.id, title: event.title, startsAt: event.startsAt, status: event.status, offlineEnabled: event.offlineEnabled, venue: event.venue, canScan: !!assignment?.canScan || orgCanScan, canSell: !!assignment?.canSell || orgCanSell }
  })
})
