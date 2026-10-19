import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { events, ticketCategories, promoCodes } from '~~/server/db/schema'
import { getFeeConfig } from '~~/server/services/settings'
import { applyPromo, computeAmounts } from '~~/shared/money'
import { fail } from '~~/server/utils/errors'
// Devis en lecture seule (aucune réservation) : sous-total, remise, frais, total.
export default api(async (e) => {
  limit(e, 'quote', 120, 600_000)
  const b = await parseBody(e, z.object({ eventId: z.string().uuid(), items: z.array(z.object({ categoryId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(10), promoCode: z.string().max(40).optional() }))
  const db = useDb()
  const cats = await db.select().from(ticketCategories).where(and(eq(ticketCategories.eventId, b.eventId), inArray(ticketCategories.id, b.items.map((i) => i.categoryId)), isNull(ticketCategories.deletedAt)))
  if (cats.length !== new Set(b.items.map((i) => i.categoryId)).size) return fail(404, 'Catégorie introuvable', 'not_found')
  const lines = b.items.map((i) => ({ ...i, price: cats.find((c) => c.id === i.categoryId)!.price }))
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0)
  let discount = 0, promo: string | null = null
  if (b.promoCode) {
    const [p] = await db.select().from(promoCodes).where(and(eq(promoCodes.eventId, b.eventId), eq(promoCodes.code, b.promoCode.trim().toUpperCase()), eq(promoCodes.active, true))).limit(1)
    const now = new Date()
    if (!p || (p.startsAt && p.startsAt > now) || (p.endsAt && p.endsAt < now) || (p.maxUses != null && p.usedCount >= p.maxUses)) return fail(422, 'Code promo invalide ou expiré', 'promo')
    const el = p.categoryIds.length ? lines.filter((l) => p.categoryIds.includes(l.categoryId)) : lines
    discount = applyPromo(el.reduce((s, l) => s + l.price * l.quantity, 0), p.kind as 'percent' | 'fixed', p.value); promo = p.code
  }
  const [ev] = await db.select({ currency: events.currency }).from(events).where(eq(events.id, b.eventId)).limit(1)
  return { ...computeAmounts(subtotal, discount, lines.reduce((s, l) => s + l.quantity, 0), await getFeeConfig(db)), currency: ev?.currency ?? 'XOF', promo }
})
