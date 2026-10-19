import { and, eq, isNull } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { organizationMembers, organizations } from '~~/server/db/schema'
export default api(async (e) => {
  const u = await requireUser(e)
  return useDb().select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: organizationMembers.role, plan: organizations.plan, currency: organizations.currency })
    .from(organizationMembers).innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId)).where(and(eq(organizationMembers.userId, u.id), isNull(organizationMembers.revokedAt), isNull(organizations.deletedAt)))
})
