import { eq } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { userProfiles } from '~~/server/db/schema'
import { signedUrl } from '~~/server/services/storage'

export default api(async (e) => {
  const user = await requireUser(e)
  const [profile] = await useDb().select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1)
  if (!profile) return { fullName: user.fullName, phone: '', locale: 'fr', avatarUrl: null }
  return {
    fullName: profile.fullName,
    phone: profile.phone ?? '',
    locale: profile.locale,
    avatarUrl: profile.avatarKey ? await signedUrl(profile.avatarKey, 900) : null
  }
})
