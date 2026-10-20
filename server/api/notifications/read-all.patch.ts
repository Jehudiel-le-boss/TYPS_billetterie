import { and, eq, isNull } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { userNotifications } from '~~/server/db/schema'
import { requirePlatformFeature } from '~~/server/utils/feature-gates'

export default api(async (e) => {
  const user = await requireUser(e)
  await requirePlatformFeature(e, 'inAppNotifications')
  await useDb().update(userNotifications).set({ readAt: new Date() })
    .where(and(eq(userNotifications.userId, user.id), isNull(userNotifications.readAt)))
  return { ok: true }
})
