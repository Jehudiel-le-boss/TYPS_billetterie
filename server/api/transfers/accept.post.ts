import { and, eq, gt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { orders, orderItems, payments, ticketTransfers, tickets } from '~~/server/db/schema'
import { randomCode, randomToken, sha256 } from '~~/server/utils/crypto'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
import { requirePlatformFeature } from '~~/server/utils/feature-gates'
export default api(async (e) => {
  await requirePlatformFeature(e, 'ticketTransfers')
  limit(e, 'transfer-accept', 20, 3600_000)
  const { token } = await parseBody(e, z.object({ token: z.string().min(20).max(100) }))
  const db = useDb()
  const out = await db.transaction(async (tx) => {
    const [tr] = await tx.update(ticketTransfers).set({ status: 'completed', completedAt: new Date() }).where(and(eq(ticketTransfers.tokenHash, sha256(token)), eq(ticketTransfers.status, 'pending'), gt(ticketTransfers.expiresAt, new Date()))).returning()
    if (!tr) return null
    const [old] = await tx.select().from(tickets).where(eq(tickets.id, tr.ticketId)).for('update')
    if (!old || old.status !== 'valid') throw new Error('not_valid')
    const [src] = await tx.select().from(orders).where(eq(orders.id, old.orderId!)).limit(1)
    const k = randomToken(24)
    const [o] = await tx.insert(orders).values({ eventId: old.eventId, organizationId: src!.organizationId, buyerName: tr.toName, buyerEmail: tr.toEmail, status: 'paid', channel: 'guest', currency: old.currency, subtotal: 0, total: 0, accessTokenHash: sha256(k), paidAt: new Date(), campaign: 'transfer', isDemo: old.isDemo }).returning()
    await tx.insert(orderItems).values({ orderId: o!.id, categoryId: old.categoryId, quantity: 1, unitPrice: 0, lineTotal: 0 })
    await tx.insert(payments).values({ orderId: o!.id, provider: 'none', reference: `TYPS-TRF-${o!.id.slice(0, 8).toUpperCase()}-${randomCode(3)}`, status: 'approved', amount: 0, currency: old.currency })
    // Un seul billet valide : même ligne, nouvelle version de QR (l'ancien QR devient invalide), nouveau détenteur, nouvelle commande d'accès.
    await tx.update(tickets).set({ qrVersion: sql`${tickets.qrVersion} + 1`, holderName: tr.toName, holderEmail: tr.toEmail, orderId: o!.id }).where(eq(tickets.id, old.id))
    return { orderId: o!.id, k, eventId: old.eventId, ticketId: old.id, orgId: src!.organizationId }
  }).catch((err) => { if ((err as Error).message === 'not_valid') return 'invalid' as const; throw err })
  if (out === 'invalid') return fail(409, 'Ce billet n’est plus transférable', 'conflict')
  if (!out) return fail(400, 'Lien de transfert invalide ou expiré', 'bad_token')
  await audit(db, { organizationId: out.orgId, action: 'ticket.transfer', entityType: 'ticket', entityId: out.ticketId })
  return { orderId: out.orderId, k: out.k }
})
