import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { tickets } from '~~/server/db/schema'
import { cancelTicket } from '~~/server/services/tickets'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const id = uuidParam(e, 'id')
  const [t] = await useDb().select().from(tickets).where(eq(tickets.id, id)).limit(1)
  if (!t) return fail(404, 'Billet introuvable', 'not_found')
  const { user, event } = await requireEvent(e, t.eventId, 'sales:cancel')
  const { status } = await parseBody(e, z.object({ status: z.enum(['cancelled', 'suspended']) }))
  if (!(await cancelTicket(useDb(), id, status))) return fail(409, 'Seul un billet valide peut être modifié', 'conflict')
  await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: `ticket.${status}`, entityType: 'ticket', entityId: id })
  return { ok: true }
})
