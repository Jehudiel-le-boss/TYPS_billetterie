import { eq } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { ticketCategories } from '~~/server/db/schema'
import { fail } from '~~/server/utils/errors'
export default api(async (e) => {
  const id = uuidParam(e, 'id')
  const [c] = await useDb().select().from(ticketCategories).where(eq(ticketCategories.id, id)).limit(1)
  if (!c) return fail(404, 'Catégorie introuvable', 'not_found')
  await requireEvent(e, c.eventId, 'event:write')
  if (c.sold > 0 || c.reserved > 0) return fail(409, 'Des billets existent déjà : la catégorie ne peut pas être supprimée', 'has_sales')
  await useDb().update(ticketCategories).set({ deletedAt: new Date() }).where(eq(ticketCategories.id, id))
  return { ok: true }
})
