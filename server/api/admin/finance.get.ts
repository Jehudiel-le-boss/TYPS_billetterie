import { desc, sql } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { settlements, refunds } from '~~/server/db/schema'
// Rapprochement : montants dus aux organisateurs (ventes en ligne payées − reversements enregistrés). Les reversements sont MANUELS (aucun reversement automatique FedaPay supposé).
export default api(async (e) => {
  await requirePlatformAdmin(e); const db = useDb()
  const due = (await db.execute(sql`select o.id as organization_id, o.name, coalesce(sum(ord.organizer_net) filter (where ord.channel = 'online' and ord.status = 'paid' and not ord.is_demo), 0)::bigint as online_net,
      coalesce((select sum(s.net) from settlements s where s.organization_id = o.id and s.status = 'paid'), 0)::bigint as settled,
      coalesce((select sum(s.net) from settlements s where s.organization_id = o.id and s.status = 'pending'), 0)::bigint as pending
      from organizations o left join orders ord on ord.organization_id = o.id where o.deleted_at is null group by o.id order by online_net desc limit 100`)).rows
  return { due, settlements: await db.select().from(settlements).orderBy(desc(settlements.createdAt)).limit(100), refunds: await db.select().from(refunds).orderBy(desc(refunds.createdAt)).limit(100) }
})
