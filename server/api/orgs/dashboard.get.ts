import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseQuery } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
// Tableau de bord organisateur : uniquement des agrégats réels (vide = vide).
export default api(async (e) => {
  const { orgId } = parseQuery(e, z.object({ orgId: z.string().uuid() })); await requireOrg(e, orgId, 'stats:read'); const db = useDb()
  const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as any[]
  const [t] = await rows(sql`select coalesce(sum(total) filter (where status='paid'),0)::bigint as revenue, count(*) filter (where status='paid')::int as orders, (select count(*) from tickets tk join events ev on ev.id = tk.event_id where ev.organization_id = ${orgId} and tk.status in ('valid','used'))::int as tickets, (select count(*) from check_ins c join events ev on ev.id = c.event_id where ev.organization_id = ${orgId} and c.result = 'accepted')::int as entries from orders where organization_id = ${orgId} and not is_demo`)
  const revenue30 = await rows(sql`select to_char(date_trunc('day', paid_at), 'DD/MM') as label, sum(total)::int as value from orders where organization_id = ${orgId} and status='paid' and not is_demo and paid_at > now() - interval '30 days' group by date_trunc('day', paid_at) order by date_trunc('day', paid_at)`)
  const upcoming = await rows(sql`select id, title, starts_at, status, capacity, (select coalesce(sum(sold),0)::int from ticket_categories c where c.event_id = events.id) as sold from events where organization_id = ${orgId} and deleted_at is null and coalesce(ends_at, starts_at) >= now() order by starts_at limit 5`)
  const alerts = await rows(sql`select 'refund' as kind, count(*)::int as n from refunds r join orders o on o.id = r.order_id where o.organization_id = ${orgId} and r.status = 'requested' union all select 'draft', count(*)::int from events where organization_id = ${orgId} and status = 'draft' and deleted_at is null`)
  return { totals: { revenue: Number(t.revenue), orders: t.orders, tickets: t.tickets, entries: t.entries }, revenue30, upcoming, alerts: alerts.filter((a) => a.n > 0) }
})
