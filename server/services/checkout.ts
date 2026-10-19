import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { events, eventLocations, orders, orderItems, payments, ticketCategories, promoCodes, promoCodeRedemptions, refunds, tickets } from '../db/schema'
import type { Db } from '../utils/db'
import { HttpError } from '../utils/errors'
import { randomToken, sha256, randomCode, verifyPassword } from '../utils/crypto'
import { issueTickets } from './tickets'
import { applyPromo, computeAmounts, type FeeConfig } from '../../shared/money'

export const HOLD_MINUTES = 15
export interface OnlineOrderInput { eventId: string; items: { categoryId: string; quantity: number }[]; buyer: { name: string; email: string; phone?: string }; promoCode?: string; accessCode?: string; campaign?: string; idempotencyKey?: string; demo?: boolean }
export interface CreatedOrder { orderId: string; accessToken: string; total: number; currency: string; paymentReference: string; free: boolean; expiresAt: Date | null; existing?: boolean }

const merge = (items: { categoryId: string; quantity: number }[]) => { const m = new Map<string, number>(); for (const i of items) m.set(i.categoryId, (m.get(i.categoryId) ?? 0) + i.quantity); return [...m].map(([categoryId, quantity]) => ({ categoryId, quantity })) }

/** Réserve atomiquement des places (UPDATE conditionnel + verrou d'événement) puis crée la commande en attente. */
export async function createOnlineOrder(db: Db, input: OnlineOrderInput, fees: FeeConfig, now = new Date()): Promise<CreatedOrder> {
  if (input.idempotencyKey) {
    const [ex] = await db.select().from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey)).limit(1)
    if (ex && ex.status === 'pending') return { orderId: ex.id, accessToken: '', total: ex.total, currency: ex.currency, paymentReference: '', free: ex.total === 0, expiresAt: ex.expiresAt, existing: true }
  }
  const items = merge(input.items)
  const accessToken = randomToken(24)
  const result = await db.transaction(async (tx) => {
    // Verrou par événement : sérialise les réservations concurrentes (quota ET capacité globale).
    const [ev] = await tx.select().from(events).where(and(eq(events.id, input.eventId), isNull(events.deletedAt))).for('update')
    if (!ev) throw new HttpError(404, 'Événement introuvable', 'not_found')
    if (ev.status !== 'published') throw new HttpError(409, 'Les ventes ne sont pas ouvertes pour cet événement', 'sales_closed')
    if ((ev.salesOpenAt && ev.salesOpenAt > now) || (ev.salesCloseAt && ev.salesCloseAt < now) || (ev.endsAt ?? ev.startsAt) < now) throw new HttpError(409, 'La billetterie est fermée', 'sales_closed')
    if (ev.visibility === 'invite' || (ev.visibility === 'private' && ev.accessCodeHash)) {
      if (!input.accessCode || !ev.accessCodeHash || !(await verifyPassword(input.accessCode, ev.accessCodeHash))) throw new HttpError(403, 'Code d’accès requis ou invalide', 'access_code')
    }
    const qtyTotal = items.reduce((s, i) => s + i.quantity, 0)
    if (qtyTotal > ev.maxPerOrder) throw new HttpError(422, `Maximum ${ev.maxPerOrder} billets par commande`, 'limit')
    let subtotal = 0
    const lines: { categoryId: string; quantity: number; unitPrice: number }[] = []
    for (const it of items) {
      const [cat] = await tx.update(ticketCategories).set({ reserved: sql`${ticketCategories.reserved} + ${it.quantity}` })
        .where(and(eq(ticketCategories.id, it.categoryId), eq(ticketCategories.eventId, ev.id), isNull(ticketCategories.deletedAt),
          sql`${ticketCategories.sold} + ${ticketCategories.reserved} + ${it.quantity} <= ${ticketCategories.quota}`,
          sql`(${ticketCategories.saleStart} IS NULL OR ${ticketCategories.saleStart} <= ${now})`, sql`(${ticketCategories.saleEnd} IS NULL OR ${ticketCategories.saleEnd} >= ${now})`,
          sql`${it.quantity} <= coalesce(${ticketCategories.maxPerOrder}, ${ev.maxPerOrder})`)).returning()
      if (!cat) throw new HttpError(409, 'Cette catégorie est épuisée ou indisponible pour la quantité demandée', 'sold_out', { categoryId: it.categoryId })
      lines.push({ categoryId: cat.id, quantity: it.quantity, unitPrice: cat.price }); subtotal += cat.price * it.quantity
    }
    const [{ used }] = await tx.select({ used: sql<number>`coalesce(sum(${ticketCategories.sold} + ${ticketCategories.reserved}), 0)::int` }).from(ticketCategories).where(and(eq(ticketCategories.eventId, ev.id), isNull(ticketCategories.deletedAt))) as [{ used: number }]
    if (used > ev.capacity) throw new HttpError(409, 'Capacité de l’événement atteinte', 'capacity') // annule toute la transaction

    let discount = 0, promoId: string | null = null
    if (input.promoCode) {
      const code = input.promoCode.trim().toUpperCase()
      const [p] = await tx.select().from(promoCodes).where(and(eq(promoCodes.eventId, ev.id), eq(promoCodes.code, code), eq(promoCodes.active, true))).limit(1)
      if (!p || (p.startsAt && p.startsAt > now) || (p.endsAt && p.endsAt < now)) throw new HttpError(422, 'Code promo invalide ou expiré', 'promo')
      const mine = await tx.select({ n: sql<number>`count(*)::int` }).from(promoCodeRedemptions).innerJoin(orders, eq(orders.id, promoCodeRedemptions.orderId)).where(and(eq(promoCodeRedemptions.promoCodeId, p.id), eq(promoCodeRedemptions.buyerEmail, input.buyer.email), inArray(orders.status, ['pending', 'paid'])))
      if ((mine[0]?.n ?? 0) >= p.maxPerUser) throw new HttpError(422, 'Code promo déjà utilisé', 'promo')
      const [claimed] = await tx.update(promoCodes).set({ usedCount: sql`${promoCodes.usedCount} + 1` }).where(and(eq(promoCodes.id, p.id), sql`(${promoCodes.maxUses} IS NULL OR ${promoCodes.usedCount} < ${promoCodes.maxUses})`)).returning()
      if (!claimed) throw new HttpError(422, 'Code promo épuisé', 'promo')
      const eligible = p.categoryIds.length ? lines.filter((l) => p.categoryIds.includes(l.categoryId)) : lines
      discount = applyPromo(eligible.reduce((s, l) => s + l.unitPrice * l.quantity, 0), p.kind as 'percent' | 'fixed', p.value); promoId = p.id
    }
    const amounts = computeAmounts(subtotal, discount, qtyTotal, fees)
    const free = amounts.total === 0
    const [order] = await tx.insert(orders).values({
      eventId: ev.id, organizationId: ev.organizationId, buyerName: input.buyer.name, buyerEmail: input.buyer.email, buyerPhone: input.buyer.phone ?? null, status: 'pending', channel: 'online', currency: ev.currency,
      subtotal: amounts.subtotal, discount: amounts.discount, buyerFees: amounts.buyerFees, total: amounts.total, providerFee: amounts.providerFee, platformFee: amounts.platformFee, organizerNet: amounts.organizerNet,
      promoCodeId: promoId, accessTokenHash: sha256(accessToken), expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000), campaign: input.campaign ?? null, isDemo: !!input.demo || ev.isDemo, idempotencyKey: input.idempotencyKey ?? null
    }).returning()
    await tx.insert(orderItems).values(lines.map((l) => ({ orderId: order!.id, categoryId: l.categoryId, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.unitPrice * l.quantity })))
    if (promoId) await tx.insert(promoCodeRedemptions).values({ promoCodeId: promoId, orderId: order!.id, buyerEmail: input.buyer.email, amountDiscounted: discount })
    const reference = `TYPS-${order!.id.slice(0, 8).toUpperCase()}-${randomCode(4)}`
    await tx.insert(payments).values({ orderId: order!.id, provider: free ? 'none' : input.demo ? 'demo' : 'fedapay', reference, amount: amounts.total, currency: ev.currency, status: 'initiated' })
    return { order: order!, reference, free }
  })
  if (result.free) await settleOrderPaid(db, result.order.id, { provider: 'none', amount: 0, currency: result.order.currency })
  return { orderId: result.order.id, accessToken, total: result.order.total, currency: result.order.currency, paymentReference: result.reference, free: result.free, expiresAt: result.order.expiresAt }
}

export type SettleOutcome = 'paid' | 'already_paid' | 'amount_mismatch' | 'refund_required' | 'not_found'
export interface SettleInput { provider: string; providerTxId?: string | null; amount: number; currency: string; raw?: unknown }
/** Idempotent : plusieurs webhooks / retours simultanés n'émettent les billets qu'une fois (verrou de ligne sur la commande). */
export async function settleOrderPaid(db: Db, orderId: string, p: SettleInput, now = new Date()): Promise<SettleOutcome> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update')
    if (!order) return 'not_found'
    if (order.status === 'paid') return 'already_paid'
    if (p.amount !== order.total || p.currency !== order.currency) {
      await tx.update(payments).set({ status: 'failed', raw: { mismatch: true, got: { amount: p.amount, currency: p.currency }, want: { amount: order.total, currency: order.currency } }, updatedAt: now }).where(eq(payments.orderId, orderId))
      return 'amount_mismatch'
    }
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))
    if (order.status === 'pending') {
      for (const it of items) {
        const r = await tx.update(ticketCategories).set({ reserved: sql`${ticketCategories.reserved} - ${it.quantity}`, sold: sql`${ticketCategories.sold} + ${it.quantity}` }).where(and(eq(ticketCategories.id, it.categoryId), sql`${ticketCategories.reserved} >= ${it.quantity}`)).returning({ id: ticketCategories.id })
        if (!r.length) throw new Error('Incohérence de réservation')
      }
    } else {
      // Paiement tardif (réservation expirée) : on tente de reprendre les places, sinon remboursement requis.
      let ok = true
      try {
        await tx.transaction(async (sp) => {
          for (const it of items) {
            const r = await sp.update(ticketCategories).set({ sold: sql`${ticketCategories.sold} + ${it.quantity}` }).where(and(eq(ticketCategories.id, it.categoryId), sql`${ticketCategories.sold} + ${ticketCategories.reserved} + ${it.quantity} <= ${ticketCategories.quota}`)).returning({ id: ticketCategories.id })
            if (!r.length) throw new Error('rupture')
          }
        })
      } catch { ok = false }
      if (!ok) {
        const [pay] = await tx.select().from(payments).where(eq(payments.orderId, orderId)).limit(1)
        await tx.update(payments).set({ status: 'approved', providerTxId: p.providerTxId ?? pay?.providerTxId ?? null, raw: p.raw ?? null, verifiedAt: now, updatedAt: now }).where(eq(payments.orderId, orderId))
        await tx.update(orders).set({ status: 'failed', updatedAt: now }).where(eq(orders.id, orderId))
        await tx.insert(refunds).values({ orderId, paymentId: pay?.id ?? null, amount: order.total, reason: 'Paiement reçu après expiration, plus de places disponibles', status: 'requested', requestedBy: 'system' })
        return 'refund_required'
      }
    }
    await tx.update(payments).set({ status: p.provider === 'none' ? 'approved' : 'approved', providerTxId: p.providerTxId ?? undefined, raw: p.raw ?? null, verifiedAt: now, updatedAt: now }).where(eq(payments.orderId, orderId))
    await tx.update(orders).set({ status: 'paid', paidAt: now, expiresAt: null, updatedAt: now }).where(eq(orders.id, orderId))
    for (const it of items) await issueTickets(tx as unknown as Db, { eventId: order.eventId, categoryId: it.categoryId, orderId, quantity: it.quantity, holderName: order.buyerName, holderEmail: order.buyerEmail, pricePaid: it.unitPrice, currency: order.currency, source: 'online', isDemo: order.isDemo })
    return 'paid'
  })
}

/** Libère les réservations non payées. `isPaidAtProvider` permet de ne pas expirer un paiement en cours d'approbation. */
export async function expireHolds(db: Db, now = new Date(), isPaidAtProvider?: (orderId: string) => Promise<boolean>): Promise<number> {
  const stale = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.status, 'pending'), lt(orders.expiresAt, now))).limit(200)
  let n = 0
  for (const s of stale) {
    if (isPaidAtProvider && (await isPaidAtProvider(s.id).catch(() => false))) continue
    const done = await db.transaction(async (tx) => {
      const [o] = await tx.update(orders).set({ status: 'expired', updatedAt: now }).where(and(eq(orders.id, s.id), eq(orders.status, 'pending'))).returning()
      if (!o) return false
      for (const it of await tx.select().from(orderItems).where(eq(orderItems.orderId, s.id)))
        await tx.update(ticketCategories).set({ reserved: sql`greatest(${ticketCategories.reserved} - ${it.quantity}, 0)` }).where(eq(ticketCategories.id, it.categoryId))
      if (o.promoCodeId) { await tx.update(promoCodes).set({ usedCount: sql`greatest(${promoCodes.usedCount} - 1, 0)` }).where(eq(promoCodes.id, o.promoCodeId)); await tx.delete(promoCodeRedemptions).where(eq(promoCodeRedemptions.orderId, o.id)) }
      await tx.update(payments).set({ status: 'canceled', updatedAt: now }).where(and(eq(payments.orderId, s.id), eq(payments.status, 'initiated')))
      return true
    })
    if (done) n++
  }
  return n
}

export interface PhysicalSaleInput { eventId: string; items: { categoryId: string; quantity: number }[]; paymentMethod: string; amountReceived: number; holderName: string; buyerEmail?: string; sellerId: string }
/** Vente au guichet : paiement encaissé par action explicite (confirmCollected exigé en amont) ; mêmes compteurs que le en ligne → pas de double attribution. */
export async function createPhysicalSale(db: Db, input: PhysicalSaleInput, fees: FeeConfig, now = new Date()) {
  const items = merge(input.items)
  return db.transaction(async (tx) => {
    const [ev] = await tx.select().from(events).where(and(eq(events.id, input.eventId), isNull(events.deletedAt))).for('update')
    if (!ev) throw new HttpError(404, 'Événement introuvable', 'not_found')
    if (ev.status === 'draft' || ev.status === 'cancelled' || ev.status === 'suspended') throw new HttpError(409, 'Événement non ouvert aux ventes', 'sales_closed')
    let subtotal = 0; const lines: { categoryId: string; quantity: number; unitPrice: number }[] = []
    for (const it of items) {
      const [cat] = await tx.update(ticketCategories).set({ sold: sql`${ticketCategories.sold} + ${it.quantity}` }).where(and(eq(ticketCategories.id, it.categoryId), eq(ticketCategories.eventId, ev.id), isNull(ticketCategories.deletedAt), sql`${ticketCategories.sold} + ${ticketCategories.reserved} + ${it.quantity} <= ${ticketCategories.quota}`)).returning()
      if (!cat) throw new HttpError(409, 'Catégorie épuisée ou indisponible', 'sold_out')
      lines.push({ categoryId: cat.id, quantity: it.quantity, unitPrice: cat.price }); subtotal += cat.price * it.quantity
    }
    const [{ used }] = await tx.select({ used: sql<number>`coalesce(sum(${ticketCategories.sold} + ${ticketCategories.reserved}), 0)::int` }).from(ticketCategories).where(and(eq(ticketCategories.eventId, ev.id), isNull(ticketCategories.deletedAt))) as [{ used: number }]
    if (used > ev.capacity) throw new HttpError(409, 'Capacité de l’événement atteinte', 'capacity')
    const amounts = computeAmounts(subtotal, 0, items.reduce((s, i) => s + i.quantity, 0), { ...fees, buyerPaysFees: false, providerPercentBp: 0, providerFixed: 0 })
    if (input.amountReceived < amounts.total) throw new HttpError(422, `Montant encaissé insuffisant (attendu ${amounts.total})`, 'underpaid')
    const accessToken = randomToken(24)
    const [order] = await tx.insert(orders).values({ eventId: ev.id, organizationId: ev.organizationId, buyerName: input.holderName, buyerEmail: input.buyerEmail ?? `guichet+${randomCode(6).toLowerCase()}@typs.invalid`, status: 'paid', channel: 'physical', currency: ev.currency, subtotal, discount: 0, buyerFees: 0, total: amounts.total, providerFee: 0, platformFee: amounts.platformFee, organizerNet: amounts.organizerNet, accessTokenHash: sha256(accessToken), paidAt: now, sellerId: input.sellerId, paymentMethod: input.paymentMethod, isDemo: ev.isDemo }).returning()
    await tx.insert(orderItems).values(lines.map((l) => ({ orderId: order!.id, categoryId: l.categoryId, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.unitPrice * l.quantity })))
    await tx.insert(payments).values({ orderId: order!.id, provider: 'cash_desk', reference: `TYPS-PH-${order!.id.slice(0, 8).toUpperCase()}`, status: 'approved', amount: amounts.total, currency: ev.currency, raw: { method: input.paymentMethod, received: input.amountReceived, change: input.amountReceived - amounts.total, sellerId: input.sellerId }, verifiedAt: now })
    const created = []
    for (const l of lines) created.push(...(await issueTickets(tx as unknown as Db, { eventId: ev.id, categoryId: l.categoryId, orderId: order!.id, quantity: l.quantity, holderName: input.holderName, holderEmail: input.buyerEmail, pricePaid: l.unitPrice, currency: ev.currency, source: 'physical', createdBy: input.sellerId, isDemo: ev.isDemo })))
    return { order: order!, tickets: created, accessToken }
  })
}
export async function cancelPhysicalOrder(db: Db, orderId: string, actorId: string, reason: string) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update')
    if (!o || o.channel !== 'physical') throw new HttpError(404, 'Vente introuvable', 'not_found')
    if (o.status !== 'paid') throw new HttpError(409, 'Vente déjà annulée', 'conflict')
    const used = await tx.select({ id: tickets.id }).from(tickets).where(and(eq(tickets.orderId, orderId), eq(tickets.status, 'used'))).limit(1)
    if (used.length) throw new HttpError(409, 'Un billet de cette vente a déjà servi à entrer', 'ticket_used')
    for (const it of await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))) await tx.update(ticketCategories).set({ sold: sql`greatest(${ticketCategories.sold} - ${it.quantity}, 0)` }).where(eq(ticketCategories.id, it.categoryId))
    await tx.update(tickets).set({ status: 'cancelled', cancelledAt: new Date() }).where(eq(tickets.orderId, orderId))
    await tx.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, orderId))
    await tx.update(payments).set({ status: 'canceled', raw: sql`coalesce(${payments.raw}, '{}'::jsonb) || ${JSON.stringify({ cancelledBy: actorId, reason })}::jsonb` }).where(eq(payments.orderId, orderId))
    return o
  })
}
export async function loadEventLocation(db: Db, eventId: string) { return (await db.select().from(eventLocations).where(eq(eventLocations.eventId, eventId)).limit(1))[0] ?? null }
