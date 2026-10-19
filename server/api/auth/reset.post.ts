import { and, eq, gt, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { users, authTokens, sessions } from '~~/server/db/schema'
import { hashPassword, sha256 } from '~~/server/utils/crypto'
import { passwordSchema } from '~~/shared/validation'
import { fail } from '~~/server/utils/errors'

export default api(async (e) => {
  limit(e, 'reset', 10, 3600_000)
  const { token, password } = await parseBody(e, z.object({ token: z.string().min(20).max(100), password: passwordSchema }))
  const db = useDb()
  const [t] = await db.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.kind, 'reset_password'), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).returning()
  if (!t) fail(400, 'Lien invalide ou expiré', 'bad_token')
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, t!.userId))
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, t!.userId)) // révoque toutes les sessions
  return { ok: true }
})
