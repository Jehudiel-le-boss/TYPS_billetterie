import { sql } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
export default api(async (e) => {
  await requirePlatformAdmin(e)
  const r = (await useDb().execute(sql`select
    (select count(*) from users where deleted_at is null)::int as users,
    (select count(*) from organizations where deleted_at is null)::int as organizations,
    (select count(*) from events where deleted_at is null)::int as events,
    (select count(*) from events where status = 'published' and deleted_at is null)::int as published,
    (select count(*) from tickets where status in ('valid','used'))::int as tickets,
    (select coalesce(sum(total),0) from orders where status = 'paid' and not is_demo)::bigint as gmv,
    (select coalesce(sum(platform_fee),0) from orders where status = 'paid' and not is_demo)::bigint as platform_fees,
    (select count(*) from refunds where status = 'requested')::int as refunds_open,
    (select count(*) from event_reports where status = 'open')::int as reports_open,
    (select count(*) from payment_webhook_events where processed_at is null)::int as webhooks_pending`)).rows[0]
  return r
})
