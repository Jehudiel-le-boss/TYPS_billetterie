import { and, eq, isNull } from 'drizzle-orm'
import { defineEventHandler, setHeader } from 'h3'
import { useDb } from '../utils/db'
import { events } from '../db/schema'
import { env } from '../utils/env'
export default defineEventHandler(async (e) => {
  const rows = await useDb().select({ slug: events.slug, u: events.updatedAt }).from(events).where(and(eq(events.status, 'published'), eq(events.visibility, 'public'), eq(events.moderation, 'ok'), eq(events.isDemo, false), isNull(events.deletedAt))).limit(5000).catch(() => [])
  const base = env.siteUrl()
  setHeader(e, 'Content-Type', 'application/xml')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/events', '/legal/conditions', '/legal/confidentialite', '/legal/remboursement'].map((p) => `<url><loc>${base}${p}</loc></url>`).join('')}${rows.map((r) => `<url><loc>${base}/events/${r.slug}</loc><lastmod>${r.u.toISOString()}</lastmod></url>`).join('')}</urlset>`
})
