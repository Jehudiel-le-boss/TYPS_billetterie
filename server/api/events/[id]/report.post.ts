import { z } from 'zod'
import { api, parseBody, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { eventReports } from '~~/server/db/schema'
export default api(async (e) => {
  limit(e, 'report', 5, 3600_000)
  const b = await parseBody(e, z.object({ reason: z.string().trim().min(10).max(500), email: z.string().email().optional() }))
  await useDb().insert(eventReports).values({ eventId: uuidParam(e, 'id'), reason: b.reason, reporterEmail: b.email })
  return { ok: true }
})
