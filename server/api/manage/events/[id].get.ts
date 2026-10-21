import { and, asc, eq, isNull } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { eventLocations, ticketCategories } from '~~/server/db/schema'
import { env } from '~~/server/utils/env'
import { sanitizeEventDescription } from '~~/server/utils/rich-content'
import { signedUrl } from '~~/server/services/storage'
export default api(async (e) => {
  const { event, access } = await requireEvent(e, uuidParam(e, 'id'), 'event:read')
  const db = useDb()
  const [loc] = await db.select().from(eventLocations).where(eq(eventLocations.eventId, event.id)).limit(1)
  const categories = await db.select().from(ticketCategories).where(and(eq(ticketCategories.eventId, event.id), isNull(ticketCategories.deletedAt))).orderBy(asc(ticketCategories.position), asc(ticketCategories.price))
  const { accessCodeHash, ...safe } = event
  const shareTokenRequired = event.visibility !== 'public' || event.status !== 'published' || event.moderation !== 'ok'
  return { ...safe, description: sanitizeEventDescription(safe.description), hasAccessCode: !!accessCodeHash, posterUrl: safe.posterKey ? await signedUrl(safe.posterKey, 3600) : null, location: loc ?? null, categories, access, shareUrl: `${env.siteUrl()}/events/${event.slug}${shareTokenRequired ? `?k=${event.shareToken}` : ''}` }
})
