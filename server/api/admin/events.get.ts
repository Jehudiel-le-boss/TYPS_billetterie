import { desc, eq } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { events, organizations, eventReports } from '~~/server/db/schema'
import { sql } from 'drizzle-orm'
export default api(async (e) => {
  await requirePlatformAdmin(e)
  return useDb().select({ id: events.id, slug: events.slug, title: events.title, status: events.status, moderation: events.moderation, org: organizations.name, startsAt: events.startsAt, isDemo: events.isDemo, reports: sql<number>`(select count(*) from ${eventReports} r where r.event_id = ${events.id} and r.status = 'open')::int` })
    .from(events).innerJoin(organizations, eq(organizations.id, events.organizationId)).orderBy(desc(events.createdAt)).limit(200)
})
