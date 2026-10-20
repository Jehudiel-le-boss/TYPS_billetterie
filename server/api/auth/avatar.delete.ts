import { eq } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { userProfiles } from '~~/server/db/schema'
import { deleteObject } from '~~/server/services/storage'

export default api(async (e) => {
  const user = await requireUser(e)
  const db = useDb()
  const [profile] = await db.select({ avatarKey: userProfiles.avatarKey }).from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1)
  if (profile?.avatarKey) await deleteObject(profile.avatarKey)
  await db.update(userProfiles).set({ avatarKey: null, updatedAt: new Date() }).where(eq(userProfiles.userId, user.id))
  return { ok: true }
})
