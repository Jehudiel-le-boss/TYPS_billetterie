import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { events, eventLocations } from '~~/server/db/schema'
import { organizationAsset } from '~~/server/services/assets'
import { hashPassword } from '~~/server/utils/crypto'
import { audit } from '~~/server/utils/audit'
import { sanitizeEventDescription } from '~~/server/utils/rich-content'
import { richDescriptionSchema } from '~~/shared/validation'
const schema = z.object({
  title: z.string().trim().min(3).max(140), description: richDescriptionSchema, category: z.string().trim().max(40), visibility: z.enum(['public', 'private', 'invite']),
  startsAt: z.coerce.date(), endsAt: z.coerce.date().nullable(), capacity: z.number().int().min(1).max(1_000_000), maxPerOrder: z.number().int().min(1).max(50),
  faq: z.array(z.object({ question: z.string().trim().min(3).max(160), answer: z.string().trim().min(1).max(2000) })).max(20),
  countdownEnabled: z.boolean(), countdownUnits: z.array(z.enum(['days', 'hours', 'minutes', 'seconds'])).max(4).refine((units) => new Set(units).size === units.length),
  salesOpenAt: z.coerce.date().nullable(), salesCloseAt: z.coerce.date().nullable(), themeId: z.string().max(40), accessTerms: z.string().max(1000), templateId: z.string().uuid().nullable(),
  offlineEnabled: z.boolean(), transfersEnabled: z.boolean(), accessCode: z.string().min(4).max(40).nullable(), posterKey: z.string().max(200).nullable(),
  refundPolicy: z.object({ allowed: z.boolean(), untilHoursBefore: z.number().int().min(0).max(720) }),
  venueName: z.string().max(160), address: z.string().max(300), city: z.string().max(80), lat: z.number().nullable(), lng: z.number().nullable()
}).partial()
  .refine((v) => !v.endsAt || !v.startsAt || v.endsAt >= v.startsAt, { message: 'La fin doit suivre le début', path: ['endsAt'] })
  .refine((v) => v.countdownEnabled !== true || !v.countdownUnits || v.countdownUnits.length > 0, { message: 'Choisissez au moins une unité pour le compte à rebours', path: ['countdownUnits'] })
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'event:write')
  const b = await parseBody(e, schema)
  const db = useDb()
  const { venueName, address, city, lat, lng, accessCode, posterKey, description, ...rest } = b
  const set: Record<string, unknown> = { ...rest, updatedAt: new Date() }
  if (description !== undefined) set.description = sanitizeEventDescription(description)
  if (accessCode !== undefined) set.accessCodeHash = accessCode ? await hashPassword(accessCode) : null
  if (posterKey !== undefined) {
    if (posterKey) {
      const poster = await organizationAsset(db, event.organizationId, posterKey, 'poster')
      if (!poster) throw createError({ statusCode: 403, statusMessage: 'Affiche introuvable ou non autorisée pour cette organisation.' })
    }
    set.posterKey = posterKey
  }
  await db.update(events).set(set).where(eq(events.id, event.id))
  if ([venueName, address, city, lat, lng].some((v) => v !== undefined)) await db.update(eventLocations).set({ ...(venueName !== undefined && { venueName }), ...(address !== undefined && { address }), ...(city !== undefined && { city }), ...(lat !== undefined && { lat }), ...(lng !== undefined && { lng }) }).where(eq(eventLocations.eventId, event.id))
  await audit(db, { actorId: user.id, organizationId: event.organizationId, action: 'event.update', entityType: 'event', entityId: event.id, meta: { fields: Object.keys(b) } })
  return { ok: true }
})
