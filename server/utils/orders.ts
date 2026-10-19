import { getHeader, getQuery, type H3Event } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { orders, organizationMembers } from '../db/schema'
import { useDb } from './db'
import { fail } from './errors'
import { safeEqual, sha256 } from './crypto'
import { getSessionUser } from './session'

/** Accès à une commande : jeton d'accès (lien e-mail), OU compte vérifié ayant la même adresse, OU équipe de l'organisateur. Jamais l'identifiant seul. */
export async function requireOrderAccess(e: H3Event, orderId: string) {
  const db = useDb()
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return fail(404, 'Commande introuvable', 'not_found')
  const k = String(getQuery(e).k ?? getHeader(e, 'x-order-key') ?? '')
  if (k && safeEqual(sha256(k), order.accessTokenHash)) return { order, via: 'token' as const }
  const u = await getSessionUser(e)
  if (u) {
    if (u.emailVerified && u.email.toLowerCase() === order.buyerEmail.toLowerCase()) return { order, via: 'owner' as const }
    if (u.platformRole === 'admin') return { order, via: 'admin' as const }
    const [m] = await db.select().from(organizationMembers).where(and(eq(organizationMembers.userId, u.id), eq(organizationMembers.organizationId, order.organizationId), isNull(organizationMembers.revokedAt))).limit(1)
    if (m && ['owner', 'manager', 'seller', 'viewer'].includes(m.role)) return { order, via: 'org' as const }
  }
  return fail(404, 'Commande introuvable', 'not_found')
}
