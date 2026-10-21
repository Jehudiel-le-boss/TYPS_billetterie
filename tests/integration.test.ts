import { beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { buyer, fixture, makeDb } from './helpers'
import type { Db } from '../server/utils/db'
import * as s from '../server/db/schema'
import { createOnlineOrder, createPhysicalSale, cancelPhysicalOrder, expireHolds, settleOrderPaid } from '../server/services/checkout'
import { processScan, syncOfflineScans, buildOfflinePack } from '../server/services/scan'
import { cancelTicket } from '../server/services/tickets'
import { signTicketCode } from '../server/utils/qr'
import { eventAccessOf } from '../server/utils/access'
import { ZERO_FEES } from '../shared/money'
import { eventCan } from '../shared/permissions'
import { getPlatformFeatures, setPlatformFeatures } from '../server/services/settings'
import { notifyOrganizationManagers } from '../server/services/notifications'
import { buildContext } from '../server/services/ticket-render'
import { defaultLayout } from '../shared/template'
import { organizationAsset } from '../server/services/assets'

let db: Db
beforeAll(async () => { db = await makeDb() })
const pay = async (orderId: string, total: number, currency = 'XOF') => settleOrderPaid(db, orderId, { provider: 'demo', amount: total, currency })
const cat = async (id: string) => (await db.select().from(s.ticketCategories).where(eq(s.ticketCategories.id, id)))[0]!
const ticketsOf = (orderId: string) => db.select().from(s.tickets).where(eq(s.tickets.orderId, orderId))
const scanCode = (t: { id: string; qrVersion: number }) => signTicketCode(t.id, t.qrVersion)

describe('contrôle des fonctionnalités et notifications', () => {
  it('utilise les valeurs par défaut puis persiste les choix admin', async () => {
    const f = await fixture(db)
    const defaults = await getPlatformFeatures(db)
    expect(defaults).toMatchObject({ eventCreation: true, onlineSales: true, physicalSales: true, ticketTransfers: true, offlineScanning: true, inAppNotifications: true })
    const changed = { ...defaults, physicalSales: false }
    await setPlatformFeatures(db, f.user.id, changed)
    expect(await getPlatformFeatures(db)).toEqual(changed)
    await setPlatformFeatures(db, f.user.id, defaults)
  })

  describe('propriété des fichiers d’organisation', () => {
    it('accepte une affiche Cloudinary par enregistrement et refuse les clés sans asset correspondant', async () => {
      const owner = await fixture(db)
      const other = await fixture(db)
      const storageKey = `cld:org/${owner.org.id}/poster/image-test.jpg`
      await db.insert(s.ticketTemplateAssets).values({
        organizationId: owner.org.id,
        kind: 'poster',
        storageKey,
        mime: 'image/jpeg',
        bytes: 128,
        width: 320,
        height: 180,
        createdBy: owner.user.id
      })

      await expect(organizationAsset(db, owner.org.id, storageKey, 'poster')).resolves.toMatchObject({ id: expect.any(String) })
      await expect(organizationAsset(db, other.org.id, storageKey, 'poster')).resolves.toBeNull()
      await expect(organizationAsset(db, owner.org.id, storageKey, 'background')).resolves.toBeNull()
      await expect(organizationAsset(db, owner.org.id, 'org/' + owner.org.id + '/poster/unregistered.jpg', 'poster')).resolves.toBeNull()
    })
  })

  it('notifie les gestionnaires d’organisation et respecte la désactivation admin', async () => {
    const f = await fixture(db)
    const defaults = await getPlatformFeatures(db)
    await notifyOrganizationManagers(db, f.org.id, { kind: 'test', title: 'Nouvelle vente', body: 'Une vente a été enregistrée.', href: `/app/events/${f.ev.id}` })
    let rows = await db.select().from(s.userNotifications).where(eq(s.userNotifications.userId, f.user.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'test', title: 'Nouvelle vente', href: `/app/events/${f.ev.id}` })
    await setPlatformFeatures(db, f.user.id, { ...defaults, inAppNotifications: false })
    await notifyOrganizationManagers(db, f.org.id, { kind: 'test', title: 'Ignorée', body: 'Ne doit pas apparaître.' })
    rows = await db.select().from(s.userNotifications).where(eq(s.userNotifications.userId, f.user.id))
    expect(rows).toHaveLength(1)
    await setPlatformFeatures(db, f.user.id, defaults)
  })
})

describe('quota et réservations', () => {
  it('20 achats simultanés sur 5 places : exactement 5 réussissent, jamais de survente', async () => {
    const f = await fixture(db, { quota: 5, capacity: 5 })
    const res = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], buyer: buyer(i) }, ZERO_FEES)))
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(5)
    const c = await cat(f.cat.id); expect(c.reserved).toBe(5); expect(c.sold).toBe(0)
  })
  it('la contrainte SQL interdit toute survente même en contournant le code', async () => {
    const f = await fixture(db, { quota: 3 })
    await expect(db.update(s.ticketCategories).set({ sold: 4 }).where(eq(s.ticketCategories.id, f.cat.id))).rejects.toThrow()
  })
  it('capacité globale respectée entre catégories', async () => {
    const f = await fixture(db, { quota: 10, capacity: 4 })
    const [vip] = await db.insert(s.ticketCategories).values({ eventId: f.ev.id, name: 'VIP', price: 20000, quota: 10 }).returning()
    const out = await Promise.allSettled([3, 3].map((q, i) => createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: i ? vip!.id : f.cat.id, quantity: q }], buyer: buyer(i) }, ZERO_FEES)))
    expect(out.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  })
  it('limite par commande, événement non publié, ventes hors fenêtre', async () => {
    const f = await fixture(db, { quota: 50 })
    await expect(createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 11 }], buyer: buyer() }, ZERO_FEES)).rejects.toMatchObject({ status: 422 })
    const d = await fixture(db, { status: 'draft' })
    await expect(createOnlineOrder(db, { eventId: d.ev.id, items: [{ categoryId: d.cat.id, quantity: 1 }], buyer: buyer() }, ZERO_FEES)).rejects.toMatchObject({ code: 'sales_closed' })
  })
  it('l’expiration libère les places et le code promo', async () => {
    const f = await fixture(db, { quota: 2 })
    const [p] = await db.insert(s.promoCodes).values({ organizationId: f.org.id, eventId: f.ev.id, code: 'PROMO10', kind: 'percent', value: 10, maxUses: 1 }).returning()
    const o = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 2 }], buyer: buyer(), promoCode: 'promo10' }, ZERO_FEES)
    expect((await cat(f.cat.id)).reserved).toBe(2)
    await expect(createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], buyer: buyer(2) }, ZERO_FEES)).rejects.toMatchObject({ code: 'sold_out' })
    expect(await expireHolds(db, new Date(Date.now() + 3600_000))).toBeGreaterThanOrEqual(1)
    expect((await cat(f.cat.id)).reserved).toBe(0)
    expect((await db.select().from(s.promoCodes).where(eq(s.promoCodes.id, p!.id)))[0]!.usedCount).toBe(0)
    expect((await db.select().from(s.orders).where(eq(s.orders.id, o.orderId)))[0]!.status).toBe('expired')
  })
  it('un paiement en cours de vérification n’est pas expiré', async () => {
    const f = await fixture(db, { quota: 2 })
    const o = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], buyer: buyer() }, ZERO_FEES)
    expect(await expireHolds(db, new Date(Date.now() + 3600_000), async (id) => id === o.orderId)).toBe(0)
  })
})

describe('paiement et émission des billets', () => {
  it('utilise le modèle de la catégorie puis retombe sur celui de l’événement', async () => {
    const f = await fixture(db)
    const eventLayout = defaultLayout()
    eventLayout.width = 800
    const categoryLayout = defaultLayout()
    categoryLayout.width = 1000
    const [eventTemplate] = await db.insert(s.ticketTemplates).values({
      organizationId: f.org.id, name: 'Modèle événement', draftLayout: eventLayout
    }).returning()
    const [categoryTemplate] = await db.insert(s.ticketTemplates).values({
      organizationId: f.org.id, name: 'Modèle catégorie', draftLayout: categoryLayout
    }).returning()
    await db.update(s.events).set({ templateId: eventTemplate!.id }).where(eq(s.events.id, f.ev.id))
    await db.update(s.ticketCategories).set({ templateId: categoryTemplate!.id }).where(eq(s.ticketCategories.id, f.cat.id))
    const order = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], buyer: buyer() }, ZERO_FEES)
    await pay(order.orderId, order.total)
    const [ticket] = await ticketsOf(order.orderId)
    expect((await buildContext(db, ticket!.id))?.layout.width).toBe(1000)

    await db.update(s.ticketCategories).set({ templateId: null }).where(eq(s.ticketCategories.id, f.cat.id))
    expect((await buildContext(db, ticket!.id))?.layout.width).toBe(800)
  })

  it('paiement réussi : autant de billets que de quantité payée, tous avec un QR différent', async () => {
    const f = await fixture(db); const o = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 3 }], buyer: buyer() }, ZERO_FEES)
    expect(await pay(o.orderId, o.total)).toBe('paid')
    const t = await ticketsOf(o.orderId); expect(t).toHaveLength(3); expect(new Set(t.map(scanCode)).size).toBe(3)
    const c = await cat(f.cat.id); expect(c).toMatchObject({ sold: 3, reserved: 0 })
  })
  it('webhooks rejoués / simultanés : une seule émission (idempotence)', async () => {
    const f = await fixture(db); const o = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 2 }], buyer: buyer() }, ZERO_FEES)
    const r = await Promise.all([pay(o.orderId, o.total), pay(o.orderId, o.total), pay(o.orderId, o.total)])
    expect(r.filter((x) => x === 'paid')).toHaveLength(1); expect(r.filter((x) => x === 'already_paid')).toHaveLength(2)
    expect(await ticketsOf(o.orderId)).toHaveLength(2); expect((await cat(f.cat.id)).sold).toBe(2)
  })
  it('montant ou devise différents : aucun billet', async () => {
    const f = await fixture(db); const o = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], buyer: buyer() }, ZERO_FEES)
    expect(await pay(o.orderId, o.total - 1)).toBe('amount_mismatch'); expect(await pay(o.orderId, o.total, 'USD')).toBe('amount_mismatch')
    expect(await ticketsOf(o.orderId)).toHaveLength(0)
  })
  it('paiement échoué / abandonné : pas de billet, places rendues à l’expiration', async () => {
    const f = await fixture(db, { quota: 1 }); const o = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], buyer: buyer() }, ZERO_FEES)
    await expireHolds(db, new Date(Date.now() + 3600_000)); expect(await ticketsOf(o.orderId)).toHaveLength(0); expect((await cat(f.cat.id)).reserved).toBe(0)
  })
  it('paiement tardif : places reprises si possibles, sinon remboursement requis', async () => {
    const f = await fixture(db, { quota: 1 }); const o1 = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], buyer: buyer(1) }, ZERO_FEES)
    await expireHolds(db, new Date(Date.now() + 3600_000))
    expect(await pay(o1.orderId, o1.total)).toBe('paid') // places libres : reprise
    const f2 = await fixture(db, { quota: 1 }); const a = await createOnlineOrder(db, { eventId: f2.ev.id, items: [{ categoryId: f2.cat.id, quantity: 1 }], buyer: buyer(1) }, ZERO_FEES)
    await expireHolds(db, new Date(Date.now() + 3600_000))
    const b = await createOnlineOrder(db, { eventId: f2.ev.id, items: [{ categoryId: f2.cat.id, quantity: 1 }], buyer: buyer(2) }, ZERO_FEES); await pay(b.orderId, b.total)
    expect(await pay(a.orderId, a.total)).toBe('refund_required')
    expect(await ticketsOf(a.orderId)).toHaveLength(0); expect((await db.select().from(s.refunds).where(eq(s.refunds.orderId, a.orderId))).length).toBe(1)
  })
  it('commande gratuite : billets immédiats sans paiement', async () => {
    const f = await fixture(db, { price: 0 }); const o = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 2 }], buyer: buyer() }, ZERO_FEES)
    expect(o.free).toBe(true); expect(await ticketsOf(o.orderId)).toHaveLength(2)
  })
})

describe('ventes physiques', () => {
  it('marquées « physical », partagent le quota avec le en ligne', async () => {
    const f = await fixture(db, { quota: 3 })
    const r = await createPhysicalSale(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 2 }], paymentMethod: 'cash', amountReceived: 10000, holderName: 'Client guichet', sellerId: f.user.id }, ZERO_FEES)
    expect(r.order.channel).toBe('physical'); expect(r.tickets.every((t) => t.source === 'physical')).toBe(true)
    const o = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], buyer: buyer() }, ZERO_FEES)
    await expect(createPhysicalSale(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], paymentMethod: 'cash', amountReceived: 5000, holderName: 'X', sellerId: f.user.id }, ZERO_FEES)).rejects.toMatchObject({ code: 'sold_out' })
    expect(o.orderId).toBeTruthy()
  })
  it('refuse un montant encaissé insuffisant ; l’annulation libère la place sauf si le billet a servi', async () => {
    const f = await fixture(db, { quota: 2 })
    await expect(createPhysicalSale(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], paymentMethod: 'cash', amountReceived: 100, holderName: 'X', sellerId: f.user.id }, ZERO_FEES)).rejects.toMatchObject({ code: 'underpaid' })
    const r = await createPhysicalSale(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], paymentMethod: 'cash', amountReceived: 5000, holderName: 'X', sellerId: f.user.id }, ZERO_FEES)
    await processScan(db, { eventId: f.ev.id, code: scanCode(r.tickets[0]!), gate: 'P1', agentId: f.user.id })
    await expect(cancelPhysicalOrder(db, r.order.id, f.user.id, 'erreur')).rejects.toMatchObject({ code: 'ticket_used' })
    const r2 = await createPhysicalSale(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], paymentMethod: 'cash', amountReceived: 5000, holderName: 'Y', sellerId: f.user.id }, ZERO_FEES)
    await cancelPhysicalOrder(db, r2.order.id, f.user.id, 'client parti'); expect((await cat(f.cat.id)).sold).toBe(1)
  })
})

describe('scanner', () => {
  const issue = async (opts = {}) => { const f = await fixture(db, opts); const o = await createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], buyer: buyer() }, ZERO_FEES); await pay(o.orderId, o.total); return { ...f, t: (await ticketsOf(o.orderId))[0]! } }
  it('valide puis refuse un second scan (déjà utilisé)', async () => {
    const f = await issue(); const base = { eventId: f.ev.id, code: scanCode(f.t), gate: 'P1', agentId: f.user.id }
    expect((await processScan(db, base)).result).toBe('accepted'); const again = await processScan(db, base)
    expect(again.result).toBe('already_used'); expect(again.previous?.gate).toBe('P1')
  })
  it('deux agents simultanés : un seul accepté', async () => {
    const f = await issue(); const base = { eventId: f.ev.id, code: scanCode(f.t), agentId: f.user.id }
    const r = await Promise.all(Array.from({ length: 6 }, (_, i) => processScan(db, { ...base, gate: `P${i}` })))
    expect(r.filter((x) => x.result === 'accepted')).toHaveLength(1); expect(r.filter((x) => x.result === 'already_used')).toHaveLength(5)
  })
  it('refuse : code falsifié, mauvais événement, billet annulé / remboursé / suspendu / ancien QR', async () => {
    const f = await issue(); const other = await fixture(db)
    expect((await processScan(db, { eventId: f.ev.id, code: 'TYPS1.' + 'a'.repeat(32) + '.1.' + 'b'.repeat(22), gate: 'P', agentId: null })).result).toBe('invalid')
    expect((await processScan(db, { eventId: other.ev.id, code: scanCode(f.t), gate: 'P', agentId: null })).result).toBe('wrong_event')
    expect(await cancelTicket(db, f.t.id, 'cancelled')).toBe(true); expect((await processScan(db, { eventId: f.ev.id, code: scanCode(f.t), gate: 'P', agentId: null })).result).toBe('cancelled')
    const g = await issue(); await cancelTicket(db, g.t.id, 'refunded'); expect((await processScan(db, { eventId: g.ev.id, code: scanCode(g.t), gate: 'P', agentId: null })).result).toBe('refunded')
    const h = await issue(); await cancelTicket(db, h.t.id, 'suspended'); expect((await processScan(db, { eventId: h.ev.id, code: scanCode(h.t), gate: 'P', agentId: null })).result).toBe('suspended')
    const i = await issue(); await db.update(s.tickets).set({ qrVersion: 2 }).where(eq(s.tickets.id, i.t.id)); expect((await processScan(db, { eventId: i.ev.id, code: scanCode(i.t), gate: 'P', agentId: null })).result).toBe('invalid')
  })
  it('l’historique conserve chaque tentative', async () => {
    const f = await issue(); const b = { eventId: f.ev.id, code: scanCode(f.t), gate: 'P', agentId: f.user.id }; await processScan(db, b); await processScan(db, b)
    const rows = await db.select().from(s.checkIns).where(eq(s.checkIns.eventId, f.ev.id)); expect(rows.map((r) => r.result).sort()).toEqual(['accepted', 'already_used'])
  })
  it('mode hors ligne : synchronisation et conflits entre appareils', async () => {
    const f = await issue(); const pack = await buildOfflinePack(db, f.ev.id); expect(pack).toHaveLength(1); expect(JSON.stringify(pack)).not.toContain('TYPS1')
    const d = pack[0]!.d; const at = new Date()
    const a = await syncOfflineScans(db, { eventId: f.ev.id, deviceId: 'tel-A', userId: f.user.id, scans: [{ digest: d, scannedAt: at, gate: 'P1' }, { digest: 'inconnu', scannedAt: at, gate: 'P1' }] })
    expect(a).toMatchObject({ accepted: 1, conflicts: 1 })
    const b = await syncOfflineScans(db, { eventId: f.ev.id, deviceId: 'tel-B', userId: f.user.id, scans: [{ digest: d, scannedAt: new Date(at.getTime() + 5000), gate: 'P2' }] })
    expect(b).toMatchObject({ accepted: 0, conflicts: 1 })
    expect((await db.select().from(s.checkIns).where(and(eq(s.checkIns.eventId, f.ev.id), eq(s.checkIns.conflict, true)))).length).toBe(1)
  })
})

describe('isolation entre organisations et agents', () => {
  it('un utilisateur d’une autre organisation n’a aucun droit sur l’événement', async () => {
    const a = await fixture(db), b = await fixture(db)
    const userB = { id: b.user.id, email: '', fullName: '', platformRole: 'user' as const, emailVerified: true, sessionId: '' }
    const r = await eventAccessOf(db, userB, a.ev.id); expect(r!.access.orgRole).toBeNull(); expect(eventCan(r!.access, 'event:read')).toBe(false); expect(eventCan(r!.access, 'scan')).toBe(false)
    const own = await eventAccessOf(db, userB, b.ev.id); expect(eventCan(own!.access, 'event:write')).toBe(true)
    expect(await eventAccessOf(db, userB, randomUUID())).toBeNull()
  })
  it('un agent affecté ne scanne que son événement ; la révocation est immédiate', async () => {
    const a = await fixture(db), other = await fixture(db)
    const [agent] = await db.insert(s.users).values({ email: `ag${Math.random()}@t.io`, passwordHash: 'x' }).returning()
    const u = { id: agent!.id, email: '', fullName: '', platformRole: 'user' as const, emailVerified: true, sessionId: '' }
    const [st] = await db.insert(s.eventStaff).values({ eventId: a.ev.id, userId: agent!.id, canScan: true }).returning()
    expect(eventCan((await eventAccessOf(db, u, a.ev.id))!.access, 'scan')).toBe(true)
    expect(eventCan((await eventAccessOf(db, u, a.ev.id))!.access, 'stats:read')).toBe(false)
    expect(eventCan((await eventAccessOf(db, u, other.ev.id))!.access, 'scan')).toBe(false)
    await db.update(s.eventStaff).set({ revokedAt: new Date() }).where(eq(s.eventStaff.id, st!.id))
    expect(eventCan((await eventAccessOf(db, u, a.ev.id))!.access, 'scan')).toBe(false)
  })
})

describe('promos', () => {
  it('limite d’utilisation et limite par acheteur', async () => {
    const f = await fixture(db, { quota: 20 })
    await db.insert(s.promoCodes).values({ organizationId: f.org.id, eventId: f.ev.id, code: 'ONCE', kind: 'fixed', value: 1000, maxUses: 2, maxPerUser: 1 })
    const mk = (n: number) => createOnlineOrder(db, { eventId: f.ev.id, items: [{ categoryId: f.cat.id, quantity: 1 }], buyer: buyer(n), promoCode: 'once' }, ZERO_FEES)
    const a = await mk(1); expect(a.total).toBe(4000)
    await expect(mk(1)).rejects.toMatchObject({ code: 'promo' }); await mk(2); await expect(mk(3)).rejects.toMatchObject({ code: 'promo' })
  })
})
void sql
