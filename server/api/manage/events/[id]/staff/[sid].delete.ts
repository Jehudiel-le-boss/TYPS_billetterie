import { and, eq } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { eventStaff, scannerSessions } from '~~/server/db/schema'
import { audit } from '~~/server/utils/audit'
// Révocation immédiate : l'agent perd l'accès scan/vente dès la requête suivante (contrôle serveur à chaque scan).
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'staff:manage'); const sid = uuidParam(e, 'sid')
  const [s] = await useDb().update(eventStaff).set({ revokedAt: new Date() }).where(and(eq(eventStaff.id, sid), eq(eventStaff.eventId, event.id))).returning()
  if (s) { await useDb().update(scannerSessions).set({ revokedAt: new Date() }).where(and(eq(scannerSessions.eventId, event.id), eq(scannerSessions.userId, s.userId))); await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: 'staff.revoke', entityType: 'user', entityId: s.userId, meta: { eventId: event.id } }) }
  return { ok: true }
})
