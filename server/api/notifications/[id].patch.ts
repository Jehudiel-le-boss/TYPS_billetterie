import { and, eq, isNull } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { userNotifications } from '~~/server/db/schema'
import { requirePlatformFeature } from '~~/server/utils/feature-gates'

export default api(async (e) => {
  const user = await requireUser(e)
  await requirePlatformFeature(e, 'inAppNotifications')
  const id = uuidParam(e, 'id')
  const [notification] = await useDb().update(userNotifications).set({ readAt: new Date() })
    .where(and(eq(userNotifications.id, id), eq(userNotifications.userId, user.id), isNull(userNotifications.readAt))).returning({ id: userNotifications.id })
  return { ok: true, updated: !!notification }
})
