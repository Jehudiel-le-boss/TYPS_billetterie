import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { userNotifications } from '~~/server/db/schema'
import { isPlatformFeatureEnabled } from '~~/server/services/settings'

export default api(async (e) => {
  const user = await requireUser(e)
  const db = useDb()
  if (!(await isPlatformFeatureEnabled(db, 'inAppNotifications'))) return { enabled: false, items: [], unread: 0 }
  const [items, count] = await Promise.all([
    db.select().from(userNotifications).where(eq(userNotifications.userId, user.id)).orderBy(desc(userNotifications.createdAt)).limit(50),
    db.select({ unread: sql<number>`count(*)::int` }).from(userNotifications).where(and(eq(userNotifications.userId, user.id), isNull(userNotifications.readAt)))
  ])
  return { enabled: true, items, unread: count[0]?.unread ?? 0 }
})
