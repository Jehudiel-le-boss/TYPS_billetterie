import { sql } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
// Statistiques calculées uniquement depuis la base : aucune valeur inventée (listes vides si aucune donnée).
export default api(async (e) => {
  const { event } = await requireEvent(e, uuidParam(e, 'id'), 'stats:read')
  const db = useDb(); const id = event.id
  const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as any[]
  const [byDay, byCategory, byChannel, orderStatus, entries, promos, hourly] = await Promise.all([
    rows(sql`select to_char(date_trunc('day', paid_at at time zone ${event.timezone}), 'YYYY-MM-DD') as day, sum(total)::int as revenue, count(*)::int as orders from orders where event_id = ${id} and status = 'paid' group by 1 order by 1`),
    rows(sql`select c.name, c.quota, c.sold, c.reserved, (c.sold * c.price)::int as revenue from ticket_categories c where c.event_id = ${id} and c.deleted_at is null order by c.position, c.price`),
    rows(sql`select channel, count(distinct o.id)::int as orders, coalesce(sum(o.total),0)::int as revenue, (select count(*) from tickets t where t.order_id = any(array_agg(o.id)))::int as tickets from orders o where o.event_id = ${id} and o.status = 'paid' group by channel`),
    rows(sql`select status, count(*)::int as n from orders where event_id = ${id} group by status`),
    rows(sql`select count(*) filter (where result = 'accepted')::int as accepted, count(*) filter (where result = 'already_used')::int as duplicates, count(*) filter (where result not in ('accepted','already_used'))::int as refused from check_ins where event_id = ${id}`),
    rows(sql`select p.code, p.used_count, coalesce(sum(r.amount_discounted),0)::int as discounted from promo_codes p left join promo_code_redemptions r on r.promo_code_id = p.id where p.event_id = ${id} group by p.id`),
    rows(sql`select to_char(h, 'DD HH24"h"') as hour, n from (select date_trunc('hour', scanned_at at time zone ${event.timezone}) as h, count(*)::int as n from check_ins where event_id = ${id} and result = 'accepted' group by 1) t order by h`)
  ])
  const paid = orderStatus.find((s) => s.status === 'paid')?.n ?? 0, total = orderStatus.reduce((s, r) => s + r.n, 0)
  return { currency: event.currency, capacity: event.capacity, byDay, byCategory, byChannel, orderStatus, entries: entries[0] ?? { accepted: 0, duplicates: 0, refused: 0 }, promos, hourly,
    conversion: total ? { paid, total, rate: Math.round((paid / total) * 1000) / 10 } : null,
    soldTotal: byCategory.reduce((s, c) => s + c.sold, 0), revenueTotal: byDay.reduce((s, d) => s + d.revenue, 0) }
})
