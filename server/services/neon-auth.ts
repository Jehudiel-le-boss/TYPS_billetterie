import { createRemoteJWKSet, errors, jwtVerify } from 'jose'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { Db } from '../utils/db'
import { users, userProfiles } from '../db/schema'
import { env } from '../utils/env'
import { fail, HttpError } from '../utils/errors'
import { startSession } from '../utils/session'

export interface NeonAuthIdentity {
  id: string
  email: string
  name: string | null
  email_verified: boolean
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function remoteKeys(baseUrl: string) {
  let keys = keySets.get(baseUrl)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${baseUrl}/.well-known/jwks.json`), { cacheMaxAge: 10 * 60_000 })
    keySets.set(baseUrl, keys)
  }
  return keys
}

export async function verifyNeonAccessToken(token: string): Promise<string> {
  const baseUrl = env.neonAuthBaseUrl()
  if (!baseUrl) fail(503, 'Neon Auth n’est pas configuré', 'neon_auth_not_configured')
  if (token.length > 8192) fail(401, 'Jeton Neon invalide', 'invalid_neon_token')

  try {
    const { payload } = await jwtVerify(token, remoteKeys(baseUrl), { algorithms: ['EdDSA', 'ES256', 'RS256'] })
    const subject = payload.sub
    if (typeof subject !== 'string') throw new HttpError(401, 'Identité Neon invalide', 'invalid_neon_identity')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subject))
      throw new HttpError(401, 'Identité Neon invalide', 'invalid_neon_identity')
    return subject
  } catch (error) {
    if (error instanceof TypeError) fail(503, 'Le service de vérification Neon est momentanément indisponible', 'neon_auth_unavailable')
    if (error instanceof errors.JOSEError) {
      if (error.code === 'ERR_JWKS_TIMEOUT') fail(503, 'Le service de vérification Neon est momentanément indisponible', 'neon_auth_unavailable')
      fail(401, 'Session Neon invalide ou expirée', 'invalid_neon_token')
    }
    throw error
  }
}

export async function getNeonAuthIdentity(db: Db, neonUserId: string): Promise<NeonAuthIdentity> {
  const identityResult = await db.execute(sql`
    select id::text as id, email, name, "emailVerified" as email_verified
    from neon_auth."user"
    where id::text = ${neonUserId}
    limit 1
  `)
  const identity = identityResult.rows[0] as NeonAuthIdentity | undefined
  if (!identity) throw new HttpError(403, 'Vérifie ton adresse e-mail Neon avant de continuer', 'neon_email_unverified')
  if (!identity.email_verified) throw new HttpError(403, 'Vérifie ton adresse e-mail Neon avant de continuer', 'neon_email_unverified')
  return identity
}

export async function syncNeonIdentity(db: Db, identity: NeonAuthIdentity): Promise<string> {
  if (!identity.email_verified) fail(403, 'Vérifie ton adresse e-mail Neon avant de continuer', 'neon_email_unverified')
  const email = identity.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail(401, 'Adresse e-mail Neon invalide', 'invalid_neon_identity')

  return db.transaction(async (tx) => {
    const [linked] = await tx.select().from(users).where(eq(users.neonAuthUserId, identity.id)).for('update')
    const [byEmail] = linked ? [undefined] : await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1).for('update')
    const user = linked ?? byEmail

    if (user && (user.deletedAt || user.status !== 'active')) fail(403, 'Ce compte TYPS est désactivé', 'account_disabled')
    if (user?.neonAuthUserId && user.neonAuthUserId !== identity.id) fail(409, 'Cette adresse est déjà liée à un autre compte Neon', 'identity_already_linked')
    if (linked) {
      const [emailOwner] = await tx.select({ id: users.id }).from(users)
        .where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, linked.id))).limit(1).for('update')
      if (emailOwner) fail(409, 'Cette adresse e-mail est déjà utilisée par un autre compte TYPS', 'email_already_in_use')
    }

    if (user) {
      await tx.update(users).set({
        email,
        emailVerifiedAt: new Date(),
        neonAuthUserId: identity.id
      }).where(eq(users.id, user.id))
      return user.id
    }

    const [created] = await tx.insert(users).values({
      email,
      emailVerifiedAt: new Date(),
      neonAuthUserId: identity.id,
      passwordHash: null
    }).returning({ id: users.id })
    await tx.insert(userProfiles).values({
      userId: created!.id,
      fullName: identity.name?.trim() || email.split('@')[0]!
    })
    return created!.id
  })
}

export async function establishNeonSession(e: H3Event, db: Db, token: string): Promise<void> {
  const neonUserId = await verifyNeonAccessToken(token)
  const identity = await getNeonAuthIdentity(db, neonUserId)
  const userId = await syncNeonIdentity(db, identity)
  await startSession(e, userId, db)
}

export function assertLegacyAuthDisabled() {
  if (env.isProd()) fail(503, 'L’authentification Neon doit être configurée avant les connexions en production', 'neon_auth_not_configured')
  if (env.neonAuthBaseUrl()) fail(410, 'Ce flux de connexion n’est plus utilisé. Connecte-toi avec Neon Auth.', 'legacy_auth_disabled')
}
