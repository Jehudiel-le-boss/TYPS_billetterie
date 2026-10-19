import { and, eq } from 'drizzle-orm'
import { orders, payments } from '../db/schema'
import type { Db } from '../utils/db'
import { fetchTransaction } from './fedapay'
import { settleOrderPaid, type SettleOutcome } from './checkout'

export type Verification = { state: 'paid' | 'pending' | 'failed' | 'mismatch' | 'refund_required'; providerStatus?: string }
/** Vérification serveur-à-serveur auprès de FedaPay puis règlement idempotent. Seul le statut réel (et montant + devise) fait foi. */
export async function verifyAndSettle(db: Db, orderId: string): Promise<Verification> {
  const [pay] = await db.select().from(payments).where(and(eq(payments.orderId, orderId), eq(payments.provider, 'fedapay'))).limit(1)
  if (!pay?.providerTxId) return { state: 'pending' }
  const tx = await fetchTransaction(pay.providerTxId)
  await db.update(payments).set({ status: tx.status === 'approved' ? 'approved' : tx.status === 'declined' ? 'declined' : tx.status === 'canceled' ? 'canceled' : tx.status === 'refunded' ? 'refunded' : 'pending', raw: tx.raw as object, updatedAt: new Date() }).where(eq(payments.id, pay.id))
  if (tx.status === 'approved') {
    const out: SettleOutcome = await settleOrderPaid(db, orderId, { provider: 'fedapay', providerTxId: tx.id, amount: tx.amount, currency: tx.currency, raw: tx.raw })
    if (out === 'paid' || out === 'already_paid') return { state: 'paid', providerStatus: tx.status }
    if (out === 'refund_required') return { state: 'refund_required', providerStatus: tx.status }
    return { state: 'mismatch', providerStatus: tx.status }
  }
  if (tx.status === 'declined' || tx.status === 'canceled') {
    await db.update(orders).set({ expiresAt: new Date(0) }).where(and(eq(orders.id, orderId), eq(orders.status, 'pending'))) // libération au prochain passage d'expiration
    return { state: 'failed', providerStatus: tx.status }
  }
  return { state: 'pending', providerStatus: tx.status }
}
