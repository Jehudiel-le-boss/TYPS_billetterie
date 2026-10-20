import { z } from 'zod'
import { api, parseBody } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { userProfiles } from '~~/server/db/schema'

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().transform((value) => value || null),
  locale: z.enum(['fr', 'en']).default('fr')
}).strict()

export default api(async (e) => {
  const user = await requireUser(e)
  const value = await parseBody(e, profileSchema)
  const [profile] = await useDb().insert(userProfiles).values({
    userId: user.id,
    fullName: value.fullName,
    phone: value.phone,
    locale: value.locale
  }).onConflictDoUpdate({
    target: userProfiles.userId,
    set: { fullName: value.fullName, phone: value.phone, locale: value.locale, updatedAt: new Date() }
  }).returning()
  return { fullName: profile!.fullName, phone: profile!.phone ?? '', locale: profile!.locale }
})
