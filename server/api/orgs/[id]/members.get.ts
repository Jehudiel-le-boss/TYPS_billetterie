import { and, eq, isNull } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { organizationMembers, users, userProfiles } from '~~/server/db/schema'
export default api(async (e) => {
  const orgId = uuidParam(e, 'id'); await requireOrg(e, orgId, 'staff:manage')
  return useDb().select({ id: organizationMembers.id, userId: users.id, email: users.email, name: userProfiles.fullName, role: organizationMembers.role })
    .from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId)).leftJoin(userProfiles, eq(userProfiles.userId, users.id)).where(and(eq(organizationMembers.organizationId, orgId), isNull(organizationMembers.revokedAt)))
})
