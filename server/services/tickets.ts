import { eq, sql } from 'drizzle-orm'
import { ticketBatches, tickets, ticketCategories } from '../db/schema'
import type { Db } from '../utils/db'
import { ticketRef } from '../utils/crypto'

type Channel = 'online' | 'physical' | 'guest' | 'import'
export interface IssueInput { eventId: string; categoryId: string; orderId?: string | null; quantity: number; holderName: string; holderEmail?: string | null; pricePaid: number; currency: string; source: Channel; createdBy?: string | null; isDemo?: boolean }
/** Émet N billets individuels, chacun avec sa propre référence ; le QR est dérivé de (id, qr_version) et signé. */
export async function issueTickets(tx: Db, i: IssueInput) {
  const [batch] = await tx.insert(ticketBatches).values({ eventId: i.eventId, categoryId: i.categoryId, source: i.source, orderId: i.orderId ?? null, quantity: i.quantity, createdBy: i.createdBy ?? null }).returning()
  const rows = Array.from({ length: i.quantity }, () => ({
    eventId: i.eventId, categoryId: i.categoryId, orderId: i.orderId ?? null, batchId: batch!.id, ref: ticketRef(), holderName: i.holderName, holderEmail: i.holderEmail ?? null,
    pricePaid: i.pricePaid, currency: i.currency, source: i.source, isDemo: !!i.isDemo
  }))
  return tx.insert(tickets).values(rows).returning()
}
/** Annule un billet : libère la place (sold - 1) et invalide le QR. Refusé si déjà utilisé. */
export async function cancelTicket(db: Db, ticketId: string, status: 'cancelled' | 'refunded' | 'suspended' = 'cancelled'): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [t] = await tx.update(tickets).set({ status, cancelledAt: new Date() }).where(sql`${tickets.id} = ${ticketId} AND ${tickets.status} = 'valid'`).returning()
    if (!t) return false
    if (status !== 'suspended') await tx.update(ticketCategories).set({ sold: sql`${ticketCategories.sold} - 1` }).where(eq(ticketCategories.id, t.categoryId))
    return true
  })
}
