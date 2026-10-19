import { and, eq, isNull } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { events, eventLocations, ticketCategories } from '~~/server/db/schema'
import { randomCode, randomToken } from '~~/server/utils/crypto'
import { slugify } from '~~/server/services/events'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'event:write')
  const db = useDb()
  const copy = await db.transaction(async (tx) => {
    const { id: _i, createdAt: _c, updatedAt: _u, slug: _s, shareToken: _t, ...rest } = event
    const [n] = await tx.insert(events).values({ ...rest, title: `${event.title} (copie)`, slug: `${slugify(event.title)}-${randomCode(4).toLowerCase()}`, shareToken: randomToken(12), status: 'draft', isDemo: false }).returning()
    const [loc] = await tx.select().from(eventLocations).where(eq(eventLocations.eventId, event.id)).limit(1)
    if (loc) { const { id: _l, eventId: _e, ...l } = loc; await tx.insert(eventLocations).values({ ...l, eventId: n!.id }) }
    for (const c of await tx.select().from(ticketCategories).where(and(eq(ticketCategories.eventId, event.id), isNull(ticketCategories.deletedAt)))) { const { id: _x, eventId: _ev, sold: _s2, reserved: _r, createdAt: _ca, ...cat } = c; await tx.insert(ticketCategories).values({ ...cat, eventId: n!.id }) }
    return n!
  })
  await audit(db, { actorId: user.id, organizationId: event.organizationId, action: 'event.duplicate', entityType: 'event', entityId: copy.id, meta: { from: event.id } })
  return { id: copy.id }
})
