import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { buildOfflinePack } from '~~/server/services/scan'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
export const OFFLINE_TTL_HOURS = 12
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'eventId'), 'scan')
  if (!event.offlineEnabled) return fail(403, 'Le mode hors ligne est désactivé pour cet événement par l’organisateur', 'offline_disabled')
  const tickets = await buildOfflinePack(useDb(), event.id)
  await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: 'offline.pack.download', entityType: 'event', entityId: event.id, meta: { tickets: tickets.length } })
  return { eventId: event.id, generatedAt: new Date(), expiresAt: new Date(Date.now() + OFFLINE_TTL_HOURS * 3600_000), tickets }
})
