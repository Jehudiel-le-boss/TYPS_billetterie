import { api, parseBody } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { events, eventLocations } from '~~/server/db/schema'
import { eventCreateSchema } from '~~/shared/validation'
import { randomCode, randomToken } from '~~/server/utils/crypto'
import { slugify } from '~~/server/services/events'
import { audit } from '~~/server/utils/audit'
import { requirePlatformFeature } from '~~/server/utils/feature-gates'
import { sanitizeEventDescription } from '~~/server/utils/rich-content'
export default api(async (e) => {
  await requirePlatformFeature(e, 'eventCreation')
  const b = await parseBody(e, eventCreateSchema)
  const { user } = await requireOrg(e, b.organizationId, 'event:write')
  const db = useDb()
  const ev = await db.transaction(async (tx) => {
    const [ev] = await tx.insert(events).values({ organizationId: b.organizationId, slug: `${slugify(b.title)}-${randomCode(4).toLowerCase()}`, title: b.title, description: sanitizeEventDescription(b.description), category: b.category, visibility: b.visibility, shareToken: randomToken(12),
      startsAt: b.startsAt, endsAt: b.endsAt, timezone: b.timezone, currency: b.currency, capacity: b.capacity, maxPerOrder: b.maxPerOrder, salesOpenAt: b.salesOpenAt, salesCloseAt: b.salesCloseAt, themeId: b.themeId, faq: b.faq, countdownEnabled: b.countdownEnabled, countdownUnits: b.countdownUnits }).returning()
    await tx.insert(eventLocations).values({ eventId: ev!.id, venueName: b.venueName, address: b.address, city: b.city, lat: b.lat, lng: b.lng })
    return ev!
  })
  await audit(db, { actorId: user.id, organizationId: b.organizationId, action: 'event.create', entityType: 'event', entityId: ev.id })
  return { id: ev.id, slug: ev.slug }
})
