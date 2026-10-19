import { desc, eq, sql } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { settlements } from '~~/server/db/schema'
// Rapprochement organisateur : net des ventes en ligne payées vs reversements enregistrés (manuels).
export default api(async (e) => {
  const orgId = uuidParam(e, 'id'); await requireOrg(e, orgId, 'finance:read'); const db = useDb()
  const r = (await db.execute(sql`select
    coalesce(sum(organizer_net) filter (where channel = 'online' and status = 'paid' and not is_demo), 0)::bigint as online_net,
    coalesce(sum(total) filter (where channel = 'physical' and status = 'paid' and not is_demo), 0)::bigint as cash_collected,
    coalesce(sum(platform_fee) filter (where status = 'paid' and not is_demo), 0)::bigint as platform_fees,
    coalesce(sum(provider_fee) filter (where channel = 'online' and status = 'paid' and not is_demo), 0)::bigint as provider_fees
    from orders where organization_id = ${orgId}`)).rows[0] as any
  const settled = (await db.execute(sql`select coalesce(sum(net),0)::bigint as n from settlements where organization_id = ${orgId} and status = 'paid'`)).rows[0] as any
  return { onlineNet: Number(r.online_net), cashCollected: Number(r.cash_collected), platformFees: Number(r.platform_fees), providerFees: Number(r.provider_fees), settled: Number(settled.n), toSettle: Number(r.online_net) - Number(settled.n), list: await db.select().from(settlements).where(eq(settlements.organizationId, orgId)).orderBy(desc(settlements.createdAt)).limit(50) }
})
