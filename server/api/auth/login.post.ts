import { sql } from 'drizzle-orm'
import { api, parseBody, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { users } from '~~/server/db/schema'
import { verifyPassword } from '~~/server/utils/crypto'
import { loginSchema } from '~~/shared/validation'
import { fail } from '~~/server/utils/errors'
import { startSession } from '~~/server/utils/session'
import { assertLegacyAuthDisabled } from '~~/server/services/neon-auth'

const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '=='
export default api(async (e) => {
  assertLegacyAuthDisabled()
  const b = await parseBody(e, loginSchema)
  limit(e, 'login-ip', 20, 600_000); limit(e, 'login-acct', 8, 600_000, b.email)
  const [u] = await useDb().select().from(users).where(sql`lower(${users.email}) = ${b.email} AND ${users.deletedAt} IS NULL`).limit(1)
  const ok = await verifyPassword(b.password, u?.passwordHash ?? DUMMY) // temps constant même si le compte n'existe pas
  if (!u || !ok || u.status !== 'active') fail(401, 'E-mail ou mot de passe incorrect', 'bad_credentials')
  await startSession(e, u!.id)
  return { ok: true }
})
