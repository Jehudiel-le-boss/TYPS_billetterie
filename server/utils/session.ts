import { and, eq, gt, isNull } from 'drizzle-orm'
import { getCookie, setCookie, deleteCookie, getHeader, type H3Event } from 'h3'
import { users, userProfiles, sessions } from '../db/schema'
import { useDb, type Db } from './db'
import { randomToken, sha256 } from './crypto'
import { env } from './env'
import { fail } from './errors'
import { clientIp } from './api'

const COOKIE = 'typs_session'
const TTL_MS = 30 * 24 * 3600 * 1000
export interface SessionUser { id: string; email: string; fullName: string; platformRole: 'user' | 'admin'; emailVerified: boolean; sessionId: string }

export async function startSession(e: H3Event, userId: string, db: Db = useDb()) {
  const token = randomToken(32)
  await db.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MS), ip: clientIp(e), userAgent: (getHeader(e, 'user-agent') ?? '').slice(0, 200) })
  setCookie(e, COOKIE, token, { httpOnly: true, secure: env.isProd(), sameSite: 'lax', path: '/', maxAge: TTL_MS / 1000 })
}
export async function endSession(e: H3Event) {
  const t = getCookie(e, COOKIE)
  if (t) await useDb().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256(t)))
  deleteCookie(e, COOKIE, { path: '/' })
}
export async function getSessionUser(e: H3Event): Promise<SessionUser | null> {
  const cached = (e.context as any).__user as SessionUser | null | undefined
  if (cached !== undefined) return cached
  const t = getCookie(e, COOKIE)
  let out: SessionUser | null = null
  if (t) {
    const [row] = await useDb().select({ sid: sessions.id, id: users.id, email: users.email, role: users.platformRole, verified: users.emailVerifiedAt, status: users.status, name: userProfiles.fullName })
      .from(sessions).innerJoin(users, eq(users.id, sessions.userId)).leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(and(eq(sessions.tokenHash, sha256(t)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), isNull(users.deletedAt))).limit(1)
    if (row && row.status === 'active') out = { id: row.id, email: row.email, fullName: row.name ?? '', platformRole: row.role, emailVerified: !!row.verified, sessionId: row.sid }
  }
  ;(e.context as any).__user = out
  return out
}
export async function requireUser(e: H3Event): Promise<SessionUser> {
  const u = await getSessionUser(e)
  if (!u) fail(401, 'Connexion requise', 'unauthenticated')
  return u!
}
export async function requirePlatformAdmin(e: H3Event): Promise<SessionUser> {
  const u = await requireUser(e)
  if (u.platformRole !== 'admin') fail(403, 'Réservé aux administrateurs TYPS', 'forbidden')
  return u
}
