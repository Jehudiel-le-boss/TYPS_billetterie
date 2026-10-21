import { and, eq } from 'drizzle-orm'
import { events, eventLocations, orders, ticketCategories, ticketTemplates, ticketTemplateVersions, ticketTemplateAssets, tickets } from '../db/schema'
import type { Db } from '../utils/db'
import { HttpError } from '../utils/errors'
import { signTicketCode } from '../utils/qr'
import { getObject } from './storage'
import { renderTicketPdf, renderSheetPdf, type AssetLoader } from './pdf'
import { defaultLayout, sanitizeLayout, ticketTypeLabel, type TemplateLayout, type TicketContext } from '../../shared/template'
import { formatMoney } from '../../shared/money'

export async function loadLayout(db: Db, templateId: string | null): Promise<TemplateLayout | null> {
  if (!templateId) return null
  const [t] = await db.select().from(ticketTemplates).where(eq(ticketTemplates.id, templateId)).limit(1)
  if (!t) return null
  if (t.currentVersionId) { const [v] = await db.select().from(ticketTemplateVersions).where(eq(ticketTemplateVersions.id, t.currentVersionId)).limit(1); if (v) return sanitizeLayout(v.layout) }
  return sanitizeLayout(t.draftLayout)
}
export const assetLoader = (db: Db): AssetLoader => async (assetId) => {
  const [a] = await db.select().from(ticketTemplateAssets).where(eq(ticketTemplateAssets.id, assetId)).limit(1)
  if (!a || (a.mime !== 'image/png' && a.mime !== 'image/jpeg')) return null
  return { bytes: await getObject(a.storageKey), mime: a.mime }
}
const fmtDate = (d: Date, tz: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(d).replace(',', ' ·')
export async function buildContext(db: Db, ticketId: string): Promise<{ ctx: TicketContext; layout: TemplateLayout; code: string; ticket: typeof tickets.$inferSelect; orderId: string | null } | null> {
  const [r] = await db.select({ t: tickets, c: ticketCategories, e: events }).from(tickets).innerJoin(ticketCategories, eq(ticketCategories.id, tickets.categoryId)).innerJoin(events, eq(events.id, tickets.eventId)).where(eq(tickets.id, ticketId)).limit(1)
  if (!r) return null
  const [loc] = await db.select().from(eventLocations).where(eq(eventLocations.eventId, r.e.id)).limit(1)
  const ctx: TicketContext = {
    eventTitle: r.e.title, holderName: r.t.holderName, category: r.c.name, ticketType: ticketTypeLabel(r.c.kind, r.c.name, r.c.customType), price: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(r.t.pricePaid), currency: r.t.currency === 'XOF' ? 'FCFA' : r.t.currency,
    ticketNumber: r.t.ref,     datetime: fmtDate(r.e.startsAt, r.e.timezone), startsAt: r.e.startsAt.toISOString(), timezone: r.e.timezone,
    venue: [loc?.venueName, loc?.city].filter(Boolean).join(', '), orderId: r.t.orderId ? `CMD-${r.t.orderId.slice(0, 6).toUpperCase()}` : '—', vip: r.c.vip, accessTerms: r.e.accessTerms, demo: r.t.isDemo
  }
  const categoryLayout = await loadLayout(db, r.c.templateId)
  const eventLayout = categoryLayout ? null : await loadLayout(db, r.e.templateId)
  return { ctx, layout: categoryLayout ?? eventLayout ?? defaultLayout(), code: signTicketCode(r.t.id, r.t.qrVersion), ticket: r.t, orderId: r.t.orderId }
}
export async function ticketPdf(db: Db, ticketId: string): Promise<{ bytes: Uint8Array; ref: string; w: number; h: number }> {
  const b = await buildContext(db, ticketId)
  if (!b) throw new HttpError(404, 'Billet introuvable', 'not_found')
  if (b.ticket.status !== 'valid' && b.ticket.status !== 'used') throw new HttpError(410, 'Ce billet n’est plus valide', 'gone')
  return { bytes: await renderTicketPdf(b.layout, b.ctx, b.code, assetLoader(db)), ref: b.ticket.ref, w: b.layout.width, h: b.layout.height }
}
export async function orderPdfs(db: Db, orderId: string) {
  const rows = await db.select({ id: tickets.id }).from(tickets).where(and(eq(tickets.orderId, orderId), eq(tickets.status, 'valid')))
  const out = []
  for (const r of rows) out.push(await ticketPdf(db, r.id))
  return out
}
export const sheetFrom = (pdfs: { bytes: Uint8Array; w: number; h: number }[]) => renderSheetPdf(pdfs.map((p) => p.bytes), pdfs[0]!.w, pdfs[0]!.h)
export const priceLabel = (amount: number, currency: string) => (amount === 0 ? 'Gratuit' : formatMoney(amount, currency))
export const orderLoad = async (db: Db, id: string) => (await db.select().from(orders).where(eq(orders.id, id)).limit(1))[0] ?? null
