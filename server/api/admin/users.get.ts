import { desc, ilike, isNull, and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseQuery } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { users, userProfiles } from '~~/server/db/schema'
export default api(async (e) => {
  await requirePlatformAdmin(e)
  const { q } = parseQuery(e, z.object({ q: z.string().max(80).optional() }))
  return useDb().select({ id: users.id, email: users.email, name: userProfiles.fullName, role: users.platformRole, status: users.status, verified: users.emailVerifiedAt, createdAt: users.createdAt }).from(users).leftJoin(userProfiles, eq(userProfiles.userId, users.id)).where(and(isNull(users.deletedAt), q ? ilike(users.email, `%${q.replace(/[%_]/g, '')}%`) : undefined)).orderBy(desc(users.createdAt)).limit(100)
})
