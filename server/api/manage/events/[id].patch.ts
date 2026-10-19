import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { events, eventLocations } from '~~/server/db/schema'
import { hashPassword } from '~~/server/utils/crypto'
import { audit } from '~~/server/utils/audit'
const schema = z.object({
  title: z.string().trim().min(3).max(140), description: z.string().trim().max(8000), category: z.string().trim().max(40), visibility: z.enum(['public', 'private', 'invite']),
  startsAt: z.coerce.date(), endsAt: z.coerce.date().nullable(), capacity: z.number().int().min(1).max(1_000_000), maxPerOrder: z.number().int().min(1).max(50),
  salesOpenAt: z.coerce.date().nullable(), salesCloseAt: z.coerce.date().nullable(), themeId: z.string().max(40), accessTerms: z.string().max(1000), templateId: z.string().uuid().nullable(),
  offlineEnabled: z.boolean(), transfersEnabled: z.boolean(), accessCode: z.string().min(4).max(40).nullable(), posterKey: z.string().max(200).nullable(),
  refundPolicy: z.object({ allowed: z.boolean(), untilHoursBefore: z.number().int().min(0).max(720) }),
  venueName: z.string().max(160), address: z.string().max(300), city: z.string().max(80), lat: z.number().nullable(), lng: z.number().nullable()
}).partial()
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'event:write')
  const b = await parseBody(e, schema)
  const db = useDb()
  const { venueName, address, city, lat, lng, accessCode, posterKey, ...rest } = b
  const set: Record<string, unknown> = { ...rest, updatedAt: new Date() }
  if (accessCode !== undefined) set.accessCodeHash = accessCode ? await hashPassword(accessCode) : null
  if (posterKey !== undefined) { if (posterKey && !posterKey.startsWith(`org/${event.organizationId}/`)) throw createError({ statusCode: 403, statusMessage: 'Fichier hors de votre organisation' }); set.posterKey = posterKey }
  await db.update(events).set(set).where(eq(events.id, event.id))
  if ([venueName, address, city, lat, lng].some((v) => v !== undefined)) await db.update(eventLocations).set({ ...(venueName !== undefined && { venueName }), ...(address !== undefined && { address }), ...(city !== undefined && { city }), ...(lat !== undefined && { lat }), ...(lng !== undefined && { lng }) }).where(eq(eventLocations.eventId, event.id))
  await audit(db, { actorId: user.id, organizationId: event.organizationId, action: 'event.update', entityType: 'event', entityId: event.id, meta: { fields: Object.keys(b) } })
  return { ok: true }
})
