import { z } from 'zod'
import { api, parseBody } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { organizations, settlements } from '~~/server/db/schema'
import { audit } from '~~/server/utils/audit'
import { sql, eq } from 'drizzle-orm'
import { fail } from '~~/server/utils/errors'
export default api(async (e) => {
  const a = await requirePlatformAdmin(e)
  const b = await parseBody(e, z.object({ organizationId: z.string().uuid(), gross: z.number().int().min(0), providerFees: z.number().int().min(0), platformFees: z.number().int().min(0), reference: z.string().max(80).optional(), notes: z.string().max(300).optional(), paid: z.boolean().default(false) }))
  const net = b.gross - b.providerFees - b.platformFees
  if (net <= 0) fail(422, 'Le net du reversement doit être positif', 'invalid_settlement')
  const db = useDb()
  const settlement = await db.transaction(async (tx) => {
    const [org] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, b.organizationId)).for('update')
    if (!org) fail(404, 'Organisation introuvable', 'not_found')
    const ordersTotal = (await tx.execute(sql`select coalesce(sum(organizer_net), 0)::bigint as amount from orders where organization_id = ${b.organizationId} and channel = 'online' and status = 'paid' and not is_demo`)).rows[0] as { amount: number | string } | undefined
    const settlementsTotal = (await tx.execute(sql`select coalesce(sum(net), 0)::bigint as amount from settlements where organization_id = ${b.organizationId} and status in ('paid', 'pending')`)).rows[0] as { amount: number | string } | undefined
    const due = Number(ordersTotal?.amount ?? 0) - Number(settlementsTotal?.amount ?? 0)
    if (net > due) fail(409, 'Le reversement dépasse le solde disponible', 'settlement_exceeds_due', { due })
    const [created] = await tx.insert(settlements).values({ organizationId: b.organizationId, gross: b.gross, providerFees: b.providerFees, platformFees: b.platformFees, net, reference: b.reference, notes: b.notes, status: b.paid ? 'paid' : 'pending', paidAt: b.paid ? new Date() : null, createdBy: a.id, method: 'manual' }).returning()
    return created!
  })
  await audit(db, { actorId: a.id, organizationId: b.organizationId, action: 'settlement.create', entityType: 'settlement', entityId: settlement.id, meta: { net, status: settlement.status } })
  return settlement
})
