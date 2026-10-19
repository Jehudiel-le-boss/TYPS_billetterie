import { and, eq, sql } from 'drizzle-orm'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { ticketCategories } from '~~/server/db/schema'
import { categorySchema } from '~~/shared/validation'
import { fail } from '~~/server/utils/errors'
export default api(async (e) => {
  const id = uuidParam(e, 'id')
  const [c] = await useDb().select().from(ticketCategories).where(eq(ticketCategories.id, id)).limit(1)
  if (!c) return fail(404, 'Catégorie introuvable', 'not_found')
  const { user: _u } = await requireEvent(e, c.eventId, 'event:write')
  const b = await parseBody(e, categorySchema.partial())
  // Le quota ne peut pas descendre sous ce qui est déjà vendu + réservé (la contrainte SQL le garantit aussi).
  const [r] = await useDb().update(ticketCategories).set(b).where(and(eq(ticketCategories.id, id), sql`${b.quota ?? c.quota} >= ${ticketCategories.sold} + ${ticketCategories.reserved}`)).returning()
  if (!r) return fail(409, 'Le quota ne peut pas être inférieur aux billets déjà vendus ou réservés', 'quota_below_sold')
  return r
})
