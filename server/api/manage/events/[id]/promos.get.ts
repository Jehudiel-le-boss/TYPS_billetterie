import { desc, eq } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { promoCodes } from '~~/server/db/schema'
export default api(async (e) => { const { event } = await requireEvent(e, uuidParam(e, 'id'), 'promo:manage'); return useDb().select().from(promoCodes).where(eq(promoCodes.eventId, event.id)).orderBy(desc(promoCodes.createdAt)) })
