import { and, eq, gt, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { users, authTokens } from '~~/server/db/schema'
import { sha256 } from '~~/server/utils/crypto'
import { fail } from '~~/server/utils/errors'

export default api(async (e) => {
  const { token } = await parseBody(e, z.object({ token: z.string().min(20).max(100) }))
  const db = useDb()
  const [t] = await db.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.kind, 'verify_email'), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).returning()
  if (!t) fail(400, 'Lien invalide ou expiré', 'bad_token')
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, t!.userId))
  return { ok: true }
})
