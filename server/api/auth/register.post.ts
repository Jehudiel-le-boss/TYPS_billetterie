import { sql } from 'drizzle-orm'
import { api, parseBody, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { users, userProfiles, authTokens } from '~~/server/db/schema'
import { hashPassword, randomToken, sha256 } from '~~/server/utils/crypto'
import { registerSchema } from '~~/shared/validation'
import { fail } from '~~/server/utils/errors'
import { startSession } from '~~/server/utils/session'
import { sendEmail, mailLayout } from '~~/server/services/mail'
import { env } from '~~/server/utils/env'
import { assertLegacyAuthDisabled } from '~~/server/services/neon-auth'

export default api(async (e) => {
  assertLegacyAuthDisabled()
  limit(e, 'register', 8, 3600_000)
  const b = await parseBody(e, registerSchema)
  const db = useDb()
  const [dup] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${b.email}`).limit(1)
  if (dup) fail(409, 'Un compte existe déjà avec cette adresse', 'email_taken')
  const [u] = await db.insert(users).values({ email: b.email, passwordHash: await hashPassword(b.password) }).returning()
  await db.insert(userProfiles).values({ userId: u!.id, fullName: b.fullName, phone: b.phone })
  const token = randomToken(32)
  await db.insert(authTokens).values({ userId: u!.id, kind: 'verify_email', tokenHash: sha256(token), expiresAt: new Date(Date.now() + 48 * 3600_000) })
  void sendEmail(db, b.email, 'Confirmez votre adresse e-mail', mailLayout('Bienvenue sur TYPS', 'Confirmez votre adresse pour sécuriser votre compte et retrouver vos billets.', { label: 'Confirmer mon e-mail', url: `${env.siteUrl()}/auth/verify?token=${token}` }))
  await startSession(e, u!.id)
  return { ok: true }
})
