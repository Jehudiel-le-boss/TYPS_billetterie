import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseQuery } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { events } from '~~/server/db/schema'
export default api(async (e) => {
  const { orgId } = parseQuery(e, z.object({ orgId: z.string().uuid() }))
  await requireOrg(e, orgId, 'event:read')
  return useDb().select({ id: events.id, slug: events.slug, title: events.title, status: events.status, visibility: events.visibility, startsAt: events.startsAt, capacity: events.capacity, currency: events.currency, isDemo: events.isDemo,
    sold: sql<number>`coalesce((select sum(sold) from ticket_categories c where c.event_id = ${events.id}), 0)::int` })
    .from(events).where(and(eq(events.organizationId, orgId), isNull(events.deletedAt))).orderBy(desc(events.startsAt)).limit(200)
})
