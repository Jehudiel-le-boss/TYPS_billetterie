import { eq } from 'drizzle-orm'
import { api, parseBody, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { scanSchema } from '~~/shared/validation'
import { processScan, checkInCount } from '~~/server/services/scan'
import { tickets } from '~~/server/db/schema'
import { signTicketCode } from '~~/server/utils/qr'
// Chaque scan revérifie le droit d'accès (une révocation d'agent est donc effective immédiatement) et passe par la mise à jour atomique.
export default api(async (e) => {
  const b = await parseBody(e, scanSchema)
  const { user, event } = await requireEvent(e, b.eventId, 'scan')
  limit(e, 'scan', 600, 60_000, user.id)
  const db = useDb()
  let code = b.code
  if (/^TY-[A-Z0-9]{8}$/i.test(code.trim())) { // saisie manuelle d'une référence imprimée sur le billet
    const [t] = await db.select({ id: tickets.id, v: tickets.qrVersion }).from(tickets).where(eq(tickets.ref, code.trim().toUpperCase())).limit(1)
    code = t ? signTicketCode(t.id, t.v) : code
  }
  const out = await processScan(db, { eventId: event.id, code, gate: b.gate, agentId: user.id, deviceId: b.deviceId })
  return { ...out, entries: await checkInCount(db, event.id), capacity: event.capacity }
})
