import { and, eq, isNull } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { getSessionUser } from '~~/server/utils/session'
import { organizationMembers, organizations, eventStaff, events } from '~~/server/db/schema'

export default api(async (e) => {
  const u = await getSessionUser(e)
  if (!u) return { user: null }
  const db = useDb()
  const orgs = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, currency: organizations.currency, plan: organizations.plan, role: organizationMembers.role })
    .from(organizationMembers).innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId)).where(and(eq(organizationMembers.userId, u.id), isNull(organizationMembers.revokedAt), isNull(organizations.deletedAt)))
  const staff = await db.select({ eventId: eventStaff.eventId }).from(eventStaff).innerJoin(events, eq(events.id, eventStaff.eventId)).where(and(eq(eventStaff.userId, u.id), isNull(eventStaff.revokedAt)))
  return { user: { id: u.id, email: u.email, fullName: u.fullName, platformRole: u.platformRole, emailVerified: u.emailVerified }, orgs, isAgent: staff.length > 0 }
})
