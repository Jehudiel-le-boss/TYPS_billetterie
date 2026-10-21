import { readMultipartFormData } from 'h3'
import { api, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { userProfiles } from '~~/server/db/schema'
import { putObject, signedUrl, sniffImage } from '~~/server/services/storage'
import { randomToken } from '~~/server/utils/crypto'
import { fail } from '~~/server/utils/errors'

const MAX_AVATAR_BYTES = 4 * 1024 * 1024

export default api(async (e) => {
  const user = await requireUser(e)
  limit(e, 'avatar-upload', 10, 3600_000, user.id)
  const parts = await readMultipartFormData(e)
  const file = parts?.find((part) => part.name === 'file' && part.filename)
  if (!file) return fail(400, 'Image de profil manquante', 'validation')
  if (file.data.length > MAX_AVATAR_BYTES) return fail(413, 'Image trop volumineuse (4 Mo maximum)', 'too_large')
  const image = sniffImage(file.data)
  if (!image) return fail(415, 'Format refusé : PNG ou JPEG uniquement', 'bad_type')
  if (image.width < 1 || image.height < 1) return fail(422, 'Dimensions d’image invalides.', 'bad_image')
  if (image.width > 3000 || image.height > 3000) return fail(422, 'Image trop grande (3000 px maximum)', 'too_large')

  const ext = image.mime === 'image/png' ? 'png' : 'jpg'
  const key = await putObject(`users/${user.id}/avatar/${randomToken(18)}.${ext}`, file.data, image.mime)
  await useDb().insert(userProfiles).values({ userId: user.id, fullName: user.fullName, avatarKey: key })
    .onConflictDoUpdate({ target: userProfiles.userId, set: { avatarKey: key, updatedAt: new Date() } })
  return { avatarUrl: await signedUrl(key, 900) }
})
