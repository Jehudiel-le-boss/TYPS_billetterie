import { and, eq, isNull } from 'drizzle-orm'
import { getQuery, getRouterParam } from 'h3'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { events, eventLocations, organizations } from '~~/server/db/schema'
import { fail } from '~~/server/utils/errors'
import { safeEqual } from '~~/server/utils/crypto'
import { getSessionUser } from '~~/server/utils/session'
import { eventAccessOf } from '~~/server/utils/access'
import { eventCan } from '~~/shared/permissions'
import { categoriesWithAvailability } from '~~/server/services/events'
import { signedUrl } from '~~/server/services/storage'

export default api(async (e) => {
  const slug = String(getRouterParam(e, 'slug') ?? '').toLowerCase()
  const db = useDb()
  const [row] = await db.select({ ev: events, loc: eventLocations, org: organizations.name }).from(events).leftJoin(eventLocations, eq(eventLocations.eventId, events.id)).innerJoin(organizations, eq(organizations.id, events.organizationId)).where(and(eq(events.slug, slug), isNull(events.deletedAt))).limit(1)
  if (!row) return fail(404, 'Événement introuvable', 'not_found')
  const ev = row.ev, k = String(getQuery(e).k ?? '')
  const u = await getSessionUser(e)
  const staffView = u ? eventCan((await eventAccessOf(db, u, ev.id))?.access ?? { platformAdmin: false, orgRole: null, staff: null }, 'event:read') : false
  const linkOk = !!k && safeEqual(k, ev.shareToken)
  const publicOk = ev.status === 'published' && ev.moderation === 'ok' && (ev.visibility === 'public' || linkOk)
  if (!publicOk && !staffView && !(ev.status === 'closed' && (ev.visibility === 'public' || linkOk))) return fail(404, 'Événement introuvable', 'not_found')
  return {
    id: ev.id, slug: ev.slug, title: ev.title, description: ev.description, category: ev.category, status: ev.status, visibility: ev.visibility, startsAt: ev.startsAt, endsAt: ev.endsAt, timezone: ev.timezone, currency: ev.currency,
    themeId: ev.themeId, isDemo: ev.isDemo, requiresAccessCode: ev.visibility === 'invite' || (ev.visibility === 'private' && !!ev.accessCodeHash), transfersEnabled: ev.transfersEnabled, refundPolicy: ev.refundPolicy, maxPerOrder: ev.maxPerOrder,
    salesOpenAt: ev.salesOpenAt, salesCloseAt: ev.salesCloseAt, organizer: row.org, posterUrl: ev.posterKey ? await signedUrl(ev.posterKey, 3600) : null,
    gallery: await Promise.all(ev.galleryKeys.map((g) => signedUrl(g, 3600))),
    location: row.loc ? { venue: row.loc.venueName, address: row.loc.address, city: row.loc.city, country: row.loc.country, lat: row.loc.lat, lng: row.loc.lng } : null,
    categories: await categoriesWithAvailability(db, ev.id)
  }
})
