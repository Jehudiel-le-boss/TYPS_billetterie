import { and, asc, eq, gte, isNull, sql } from 'drizzle-orm'
import { events, eventLocations, ticketCategories, organizations } from '../db/schema'
import type { Db } from '../utils/db'
import { signedUrl } from './storage'

export const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'evenement'
export async function publicCard(ev: typeof events.$inferSelect, extra: { city?: string | null; venue?: string | null; fromPrice?: number | null; orgName?: string }) {
  return { id: ev.id, slug: ev.slug, title: ev.title, category: ev.category, startsAt: ev.startsAt, currency: ev.currency, themeId: ev.themeId, isDemo: ev.isDemo, posterUrl: ev.posterKey ? await signedUrl(ev.posterKey, 3600) : null, ...extra }
}
export async function listPublicEvents(db: Db, opts: { q?: string; category?: string; limit: number; offset: number }) {
  const where = [eq(events.status, 'published'), eq(events.visibility, 'public'), isNull(events.deletedAt), eq(events.moderation, 'ok'), gte(sql`coalesce(${events.endsAt}, ${events.startsAt})`, new Date())]
  if (opts.category) where.push(eq(events.category, opts.category))
  if (opts.q) where.push(sql`(${events.title} ILIKE ${'%' + opts.q.replace(/[%_]/g, '') + '%'})`)
  const rows = await db.select({ e: events, city: eventLocations.city, venue: eventLocations.venueName, org: organizations.name, fromPrice: sql<number | null>`(select min(price) from ticket_categories c where c.event_id = ${events.id} and c.deleted_at is null)` })
    .from(events).leftJoin(eventLocations, eq(eventLocations.eventId, events.id)).innerJoin(organizations, eq(organizations.id, events.organizationId)).where(and(...where)).orderBy(asc(events.startsAt)).limit(opts.limit).offset(opts.offset)
  return Promise.all(rows.map((r) => publicCard(r.e, { city: r.city, venue: r.venue, fromPrice: r.fromPrice, orgName: r.org })))
}
export async function categoriesWithAvailability(db: Db, eventId: string) {
  const cats = await db.select().from(ticketCategories).where(and(eq(ticketCategories.eventId, eventId), isNull(ticketCategories.deletedAt))).orderBy(asc(ticketCategories.position), asc(ticketCategories.price))
  const now = Date.now()
  return cats.map((c) => { const left = Math.max(0, c.quota - c.sold - c.reserved); const notYet = !!c.saleStart && c.saleStart.getTime() > now, over = !!c.saleEnd && c.saleEnd.getTime() < now
    return { id: c.id, name: c.name, kind: c.kind, customType: c.customType, price: c.price, vip: c.vip, available: left, soldOut: left === 0, onSale: !notYet && !over, saleStart: c.saleStart, saleEnd: c.saleEnd, maxPerOrder: c.maxPerOrder } })
}
