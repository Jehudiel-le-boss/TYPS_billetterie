import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { makeDb } from './helpers'
import type { Db } from '../server/utils/db'
import { users, userProfiles } from '../server/db/schema'
import { getNeonAuthIdentity, syncNeonIdentity, verifyNeonAccessToken, type NeonAuthIdentity } from '../server/services/neon-auth'

let db: Db
let jwksServer: ReturnType<typeof createServer>
let signToken: (subject: string, expires: string) => Promise<string>
beforeAll(async () => {
  db = await makeDb()
  await db.execute(sql`create schema neon_auth`)
  await db.execute(sql`
    create table neon_auth."user" (
      id uuid primary key,
      email text not null,
      name text,
      "emailVerified" boolean not null default false
    )
  `)

  const { publicKey, privateKey } = await generateKeyPair('EdDSA')
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'EdDSA', use: 'sig' }
  jwksServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ keys: [jwk] }))
  })
  await new Promise<void>((resolve, reject) => {
    jwksServer.once('error', reject)
    jwksServer.listen(0, '127.0.0.1', resolve)
  })
  const address = jwksServer.address()
  if (!address || typeof address === 'string') throw new Error('Could not start test JWKS server')
  vi.stubEnv('APP_ENV', 'development')
  vi.stubEnv('NEON_AUTH_BASE_URL', `http://127.0.0.1:${address.port}/db/auth`)
  signToken = (subject, expires) => new SignJWT({})
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(privateKey)
})
afterAll(async () => {
  vi.unstubAllEnvs()
  await new Promise<void>((resolve, reject) => jwksServer.close((error) => error ? reject(error) : resolve()))
})

const identity = (overrides: Partial<NeonAuthIdentity> = {}): NeonAuthIdentity => ({
  id: randomUUID(),
  email: `neon-${randomUUID()}@example.com`,
  name: 'Neon User',
  email_verified: true,
  ...overrides
})

describe('liaison des identités Neon Auth', () => {
  it('vérifie la signature du jeton avec la JWKS Neon et refuse un jeton expiré', async () => {
    const subject = randomUUID()
    expect(await verifyNeonAccessToken(await signToken(subject, '5m'))).toBe(subject)
    await expect(verifyNeonAccessToken(await signToken(subject, '0s'))).rejects.toMatchObject({
      status: 401,
      code: 'invalid_neon_token'
    })
  })

  it('refuse une signature JWT falsifiée', async () => {
    const token = await signToken(randomUUID(), '5m')
    const [header, payload, signature] = token.split('.')
    if (!header || !payload || !signature) throw new Error('Test JWT is malformed')
    const tampered = `${header}.${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`
    await expect(verifyNeonAccessToken(tampered)).rejects.toMatchObject({ status: 401, code: 'invalid_neon_token' })
  })

  it('rattache un compte TYPS existant par e-mail sans perdre son profil', async () => {
    const email = `legacy-${randomUUID()}@example.com`
    const [legacy] = await db.insert(users).values({ email: email.toUpperCase(), passwordHash: 'existing-hash' }).returning()
    await db.insert(userProfiles).values({ userId: legacy!.id, fullName: 'Nom TYPS existant' })

    const neonIdentity = identity({ email })
    expect(await syncNeonIdentity(db, neonIdentity)).toBe(legacy!.id)

    const [updatedUser] = await db.select().from(users).where(eq(users.id, legacy!.id))
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, legacy!.id))
    expect(updatedUser).toMatchObject({
      email,
      passwordHash: 'existing-hash',
      neonAuthUserId: neonIdentity.id
    })
    expect(updatedUser!.emailVerifiedAt).toBeInstanceOf(Date)
    expect(profile!.fullName).toBe('Nom TYPS existant')
  })

  it('crée un nouveau compte sans mot de passe local et conserve le nom Neon', async () => {
    const neonIdentity = identity()
    const userId = await syncNeonIdentity(db, neonIdentity)
    const [createdUser] = await db.select().from(users).where(eq(users.id, userId))
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId))

    expect(createdUser).toMatchObject({
      email: neonIdentity.email,
      passwordHash: null,
      neonAuthUserId: neonIdentity.id
    })
    expect(profile!.fullName).toBe(neonIdentity.name)
  })

  it('refuse une identité Neon non vérifiée avant le rattachement', async () => {
    const neonIdentity = identity({ email_verified: false })
    await expect(syncNeonIdentity(db, neonIdentity)).rejects.toMatchObject({ status: 403, code: 'neon_email_unverified' })
  })

  it('refuse de rattacher une adresse déjà liée à un autre compte Neon', async () => {
    const email = `linked-${randomUUID()}@example.com`
    const [user] = await db.insert(users).values({ email, neonAuthUserId: randomUUID() }).returning()
    await db.insert(userProfiles).values({ userId: user!.id, fullName: 'Compte existant' })

    await expect(syncNeonIdentity(db, identity({ email }))).rejects.toMatchObject({ status: 409, code: 'identity_already_linked' })
  })

  it('refuse le changement d’adresse Neon si elle appartient déjà à un autre compte TYPS', async () => {
    const linkedEmail = `linked-${randomUUID()}@example.com`
    const targetEmail = `taken-${randomUUID()}@example.com`
    const [linkedUser] = await db.insert(users).values({ email: linkedEmail, neonAuthUserId: randomUUID() }).returning()
    const [emailOwner] = await db.insert(users).values({ email: targetEmail }).returning()
    await db.insert(userProfiles).values([
      { userId: linkedUser!.id, fullName: 'Compte lié' },
      { userId: emailOwner!.id, fullName: 'Autre compte' }
    ])

    await expect(syncNeonIdentity(db, identity({ id: linkedUser!.neonAuthUserId!, email: targetEmail })))
      .rejects.toMatchObject({ status: 409, code: 'email_already_in_use' })
  })

  it('refuse les comptes TYPS désactivés', async () => {
    const email = `disabled-${randomUUID()}@example.com`
    const [user] = await db.insert(users).values({ email, status: 'suspended' }).returning()
    await db.insert(userProfiles).values({ userId: user!.id, fullName: 'Compte suspendu' })

    await expect(syncNeonIdentity(db, identity({ email }))).rejects.toMatchObject({ status: 403, code: 'account_disabled' })
  })

  it('ne renvoie pas une identité dont l’adresse n’est pas vérifiée dans Neon', async () => {
    const neonIdentity = identity({ email_verified: false })
    await db.execute(sql`
      insert into neon_auth."user" (id, email, name, "emailVerified")
      values (${neonIdentity.id}::uuid, ${neonIdentity.email}, ${neonIdentity.name}, false)
    `)

    await expect(getNeonAuthIdentity(db, neonIdentity.id)).rejects.toMatchObject({ status: 403, code: 'neon_email_unverified' })
  })
})
