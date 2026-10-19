import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { eventStaff, users } from '~~/server/db/schema'
import { emailSchema } from '~~/shared/validation'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'staff:manage')
  const b = await parseBody(e, z.object({ email: emailSchema, canScan: z.boolean().default(true), canSell: z.boolean().default(false), gates: z.array(z.string().max(40)).max(10).default([]) }))
  const [t] = await useDb().select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${b.email} AND ${users.deletedAt} IS NULL`).limit(1)
  if (!t) return fail(404, 'Aucun compte TYPS avec cette adresse : l’agent doit d’abord s’inscrire', 'no_account')
  await useDb().insert(eventStaff).values({ eventId: event.id, userId: t.id, canScan: b.canScan, canSell: b.canSell, gates: b.gates }).onConflictDoUpdate({ target: [eventStaff.eventId, eventStaff.userId], set: { canScan: b.canScan, canSell: b.canSell, gates: b.gates, revokedAt: null } })
  await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: 'staff.grant', entityType: 'user', entityId: t.id, meta: { eventId: event.id, ...b } })
  return { ok: true }
})
