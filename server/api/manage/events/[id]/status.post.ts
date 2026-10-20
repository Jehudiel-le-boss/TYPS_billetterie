import { eq, sql, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { events, ticketCategories } from '~~/server/db/schema'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
import { requirePlatformFeature } from '~~/server/utils/feature-gates'
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'event:write')
  const { action } = await parseBody(e, z.object({ action: z.enum(['publish', 'suspend', 'close', 'cancel', 'draft']) }))
  if (action === 'publish') await requirePlatformFeature(e, 'eventCreation')
  const db = useDb()
  if (event.moderation !== 'ok' && action === 'publish') fail(403, 'Événement modéré par TYPS : publication impossible', 'moderated')
  if (action === 'publish') {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(ticketCategories).where(and(eq(ticketCategories.eventId, event.id), isNull(ticketCategories.deletedAt))) as [{ n: number }]
    if (n === 0) fail(422, 'Ajoutez au moins une catégorie de billets avant de publier', 'no_category')
  }
  const status = ({ publish: 'published', suspend: 'suspended', close: 'closed', cancel: 'cancelled', draft: 'draft' } as const)[action]
  await db.update(events).set({ status, updatedAt: new Date() }).where(eq(events.id, event.id))
  await audit(db, { actorId: user.id, organizationId: event.organizationId, action: `event.${action}`, entityType: 'event', entityId: event.id })
  return { status }
})
