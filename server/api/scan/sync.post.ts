import { api, parseBody } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { offlineSyncSchema } from '~~/shared/validation'
import { syncOfflineScans } from '~~/server/services/scan'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const b = await parseBody(e, offlineSyncSchema)
  const { user, event } = await requireEvent(e, b.eventId, 'scan')
  const r = await syncOfflineScans(useDb(), { eventId: event.id, deviceId: b.deviceId, userId: user.id, scans: b.scans.map((s) => ({ digest: s.digest, scannedAt: s.scannedAt, gate: s.gate })) })
  await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: 'offline.sync', entityType: 'event', entityId: event.id, meta: { scans: b.scans.length, accepted: r.accepted, conflicts: r.conflicts } })
  return r
})
