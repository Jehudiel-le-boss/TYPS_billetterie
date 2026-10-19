import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { settlements } from '~~/server/db/schema'
import { audit } from '~~/server/utils/audit'
import { fail } from '~~/server/utils/errors'

export default api(async (e) => {
  const admin = await requirePlatformAdmin(e)
  const id = getRouterParam(e, 'id')
  const { status } = await parseBody(e, z.object({ status: z.enum(['paid', 'cancelled']) }))
  const db = useDb()
  const [updated] = await db.update(settlements)
    .set({ status, paidAt: status === 'paid' ? new Date() : null })
    .where(and(eq(settlements.id, id ?? ''), eq(settlements.status, 'pending')))
    .returning()
  if (!updated) fail(404, 'Reversement en attente introuvable', 'not_found')
  await audit(db, { actorId: admin.id, organizationId: updated.organizationId, action: `settlement.${status}`, entityType: 'settlement', entityId: updated.id, meta: { net: updated.net } })
  return updated
})
