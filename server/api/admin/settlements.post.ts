import { z } from 'zod'
import { api, parseBody } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { settlements } from '~~/server/db/schema'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const a = await requirePlatformAdmin(e)
  const b = await parseBody(e, z.object({ organizationId: z.string().uuid(), gross: z.number().int().min(0), providerFees: z.number().int().min(0), platformFees: z.number().int().min(0), reference: z.string().max(80).optional(), notes: z.string().max(300).optional(), paid: z.boolean().default(false) }))
  const net = b.gross - b.providerFees - b.platformFees
  const [s] = await useDb().insert(settlements).values({ organizationId: b.organizationId, gross: b.gross, providerFees: b.providerFees, platformFees: b.platformFees, net, reference: b.reference, notes: b.notes, status: b.paid ? 'paid' : 'pending', paidAt: b.paid ? new Date() : null, createdBy: a.id, method: 'manual' }).returning()
  await audit(useDb(), { actorId: a.id, organizationId: b.organizationId, action: 'settlement.create', entityType: 'settlement', entityId: s!.id, meta: { net } })
  return s
})
