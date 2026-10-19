import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { users, authTokens } from '~~/server/db/schema'
import { randomToken, sha256 } from '~~/server/utils/crypto'
import { emailSchema } from '~~/shared/validation'
import { sendEmail, mailLayout } from '~~/server/services/mail'
import { env } from '~~/server/utils/env'

export default api(async (e) => {
  limit(e, 'forgot', 5, 3600_000)
  const { email } = await parseBody(e, z.object({ email: emailSchema }))
  const db = useDb()
  const [u] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email} AND ${users.deletedAt} IS NULL`).limit(1)
  if (u) {
    const token = randomToken(32)
    await db.insert(authTokens).values({ userId: u.id, kind: 'reset_password', tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) })
    void sendEmail(db, email, 'Réinitialisation du mot de passe', mailLayout('Nouveau mot de passe', 'Ce lien est valable 1 heure. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.', { label: 'Choisir un mot de passe', url: `${env.siteUrl()}/auth/reset?token=${token}` }))
  }
  return { ok: true } // même réponse que le compte existe ou non
})
