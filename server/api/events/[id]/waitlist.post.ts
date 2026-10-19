import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { ticketCategories, waitlistEntries } from '~~/server/db/schema'
import { emailSchema } from '~~/shared/validation'
import { fail } from '~~/server/utils/errors'
export default api(async (e) => {
  limit(e, 'waitlist', 10, 3600_000)
  const eventId = uuidParam(e, 'id')
  const b = await parseBody(e, z.object({ categoryId: z.string().uuid(), email: emailSchema, name: z.string().trim().min(2).max(120), quantity: z.number().int().min(1).max(10).default(1) }))
  const [c] = await useDb().select().from(ticketCategories).where(and(eq(ticketCategories.id, b.categoryId), eq(ticketCategories.eventId, eventId))).limit(1)
  if (!c) return fail(404, 'Catégorie introuvable', 'not_found')
  if (c.quota - c.sold - c.reserved > 0) return fail(409, 'Des places sont encore disponibles', 'not_sold_out')
  await useDb().insert(waitlistEntries).values({ eventId, categoryId: c.id, email: b.email, name: b.name, quantity: b.quantity }).onConflictDoNothing()
  return { ok: true }
})
