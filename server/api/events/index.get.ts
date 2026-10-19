import { z } from 'zod'
import { api, parseQuery } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { listPublicEvents } from '~~/server/services/events'
export default api(async (e) => {
  const q = parseQuery(e, z.object({ q: z.string().max(60).optional(), category: z.string().max(40).optional(), page: z.coerce.number().int().min(1).max(500).default(1) }))
  const limit = 12
  return { items: await listPublicEvents(useDb(), { q: q.q, category: q.category, limit, offset: (q.page - 1) * limit }), page: q.page, pageSize: limit }
})
