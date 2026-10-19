import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { users, sessions } from '~~/server/db/schema'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const admin = await requirePlatformAdmin(e); const id = uuidParam(e, 'id')
  const b = await parseBody(e, z.object({ status: z.enum(['active', 'suspended']).optional(), platformRole: z.enum(['user', 'admin']).optional() }))
  if (id === admin.id) return fail(409, 'Vous ne pouvez pas modifier votre propre compte ici', 'conflict')
  await useDb().update(users).set(b).where(eq(users.id, id))
  if (b.status === 'suspended') await useDb().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, id))
  await audit(useDb(), { actorId: admin.id, action: 'admin.user.update', entityType: 'user', entityId: id, meta: b })
  return { ok: true }
})
