import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { promoCodes } from '~~/server/db/schema'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'promo:manage')
  const b = await parseBody(e, z.object({ code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/), kind: z.enum(['percent', 'fixed']), value: z.number().int().min(1).max(100_000_000), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional(), maxUses: z.number().int().min(1).optional(), maxPerUser: z.number().int().min(1).max(50).default(1), categoryIds: z.array(z.string().uuid()).default([]) }).refine((v) => v.kind !== 'percent' || v.value <= 100, { message: 'Pourcentage ≤ 100', path: ['value'] }))
  const [p] = await useDb().insert(promoCodes).values({ ...b, code: b.code.toUpperCase(), organizationId: event.organizationId, eventId: event.id }).returning()
  await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: 'promo.create', entityType: 'promo', entityId: p!.id })
  return p
})
