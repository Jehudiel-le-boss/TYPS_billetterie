import { and, eq, isNull, sql } from 'drizzle-orm'
import { events, guestLists, invitations, orders, orderItems, payments, ticketCategories } from '../db/schema'
import type { Db } from '../utils/db'
import { HttpError } from '../utils/errors'
import { randomCode, randomToken, sha256 } from '../utils/crypto'
import { issueTickets } from './tickets'
import type { GuestRow } from './csv'

/** Invitations gratuites : une commande gratuite par invité (même parcours de billet/téléchargement), place prélevée sur la catégorie. */
export async function issueGuestInvitations(db: Db, p: { eventId: string; categoryId: string; listName: string; kind: string; guests: GuestRow[]; actorId: string }) {
  return db.transaction(async (tx) => {
    const [ev] = await tx.select().from(events).where(and(eq(events.id, p.eventId), isNull(events.deletedAt))).for('update')
    if (!ev) throw new HttpError(404, 'Événement introuvable', 'not_found')
    const n = p.guests.length
    const [cat] = await tx.update(ticketCategories).set({ sold: sql`${ticketCategories.sold} + ${n}` }).where(and(eq(ticketCategories.id, p.categoryId), eq(ticketCategories.eventId, ev.id), isNull(ticketCategories.deletedAt), sql`${ticketCategories.sold} + ${ticketCategories.reserved} + ${n} <= ${ticketCategories.quota}`)).returning()
    if (!cat) throw new HttpError(409, 'Pas assez de places dans cette catégorie pour la liste', 'sold_out')
    const [{ used }] = await tx.select({ used: sql<number>`coalesce(sum(${ticketCategories.sold} + ${ticketCategories.reserved}), 0)::int` }).from(ticketCategories).where(and(eq(ticketCategories.eventId, ev.id), isNull(ticketCategories.deletedAt))) as [{ used: number }]
    if (used > ev.capacity) throw new HttpError(409, 'Capacité de l’événement atteinte', 'capacity')
    const [list] = await tx.insert(guestLists).values({ eventId: ev.id, name: p.listName, kind: p.kind }).returning()
    const links: { name: string; email: string | null; orderId: string; k: string }[] = []
    for (const g of p.guests) {
      const k = randomToken(24)
      const [o] = await tx.insert(orders).values({ eventId: ev.id, organizationId: ev.organizationId, buyerName: g.name, buyerEmail: g.email ?? `invite+${randomCode(6).toLowerCase()}@typs.invalid`, status: 'paid', channel: 'guest', currency: ev.currency, subtotal: 0, total: 0, accessTokenHash: sha256(k), paidAt: new Date(), campaign: p.kind, isDemo: ev.isDemo }).returning()
      await tx.insert(orderItems).values({ orderId: o!.id, categoryId: cat.id, quantity: 1, unitPrice: 0, lineTotal: 0 })
      await tx.insert(payments).values({ orderId: o!.id, provider: 'none', reference: `TYPS-INV-${o!.id.slice(0, 8).toUpperCase()}`, status: 'approved', amount: 0, currency: ev.currency })
      const [t] = await issueTickets(tx as unknown as Db, { eventId: ev.id, categoryId: cat.id, orderId: o!.id, quantity: 1, holderName: g.name, holderEmail: g.email, pricePaid: 0, currency: ev.currency, source: 'guest', createdBy: p.actorId, isDemo: ev.isDemo })
      await tx.insert(invitations).values({ guestListId: list!.id, eventId: ev.id, name: g.name, email: g.email, code: `INV-${randomCode(8)}`, status: 'ticket_issued', ticketId: t!.id })
      links.push({ name: g.name, email: g.email, orderId: o!.id, k })
    }
    return { listId: list!.id, links, event: ev }
  })
}
