import { api, parseBody } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { auditLogs, events, eventLocations } from '~~/server/db/schema'
import { eventCreateSchema } from '~~/shared/validation'
import { randomCode, randomToken } from '~~/server/utils/crypto'
import { slugify } from '~~/server/services/events'
import { requirePlatformFeature } from '~~/server/utils/feature-gates'
import { sanitizeEventDescription } from '~~/server/utils/rich-content'
import { HttpError } from '~~/server/utils/errors'

function databaseErrorCode(error: unknown): string | undefined {
  let current: unknown = error
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const value = current as { code?: unknown; cause?: unknown }
    if (typeof value.code === 'string' && /^[0-9A-Z]{5}$/.test(value.code)) return value.code
    current = value.cause
  }
}

export default api(async (e) => {
  const b = await parseBody(e, eventCreateSchema)
  try {
    await requirePlatformFeature(e, 'eventCreation')
    const { user } = await requireOrg(e, b.organizationId, 'event:write')
    const db = useDb()
    const ev = await db.transaction(async (tx) => {
      const [created] = await tx.insert(events).values({ organizationId: b.organizationId, slug: `${slugify(b.title)}-${randomCode(4).toLowerCase()}`, title: b.title, description: sanitizeEventDescription(b.description), category: b.category, visibility: b.visibility, shareToken: randomToken(12),
        startsAt: b.startsAt, endsAt: b.endsAt, timezone: b.timezone, currency: b.currency, capacity: b.capacity, maxPerOrder: b.maxPerOrder, salesOpenAt: b.salesOpenAt, salesCloseAt: b.salesCloseAt, themeId: b.themeId, faq: b.faq, countdownEnabled: b.countdownEnabled, countdownUnits: b.countdownUnits }).returning()
      if (!created) throw new Error('Event insert returned no row')
      await tx.insert(eventLocations).values({ eventId: created.id, venueName: b.venueName, address: b.address, city: b.city, lat: b.lat, lng: b.lng })
      await tx.insert(auditLogs).values({ actorId: user.id, organizationId: b.organizationId, action: 'event.create', entityType: 'event', entityId: created.id })
      return created
    })
    return { id: ev.id, slug: ev.slug }
  } catch (error) {
    if (error instanceof HttpError) throw error
    const code = databaseErrorCode(error)
    const reference = `EVT-${randomCode(6).toUpperCase()}`
    console.error('[event.create] Operation failed', { reference, code: code ?? 'unknown' })
    if (code === '42703' || code === '42P01') {
      throw new HttpError(503, `La base de données doit être mise à jour avant de créer des événements. L’administrateur doit exécuter « npm run db:migrate », puis redéployer le serveur. Référence : ${reference}.`, 'database_migration_required')
    }
    if (code?.startsWith('08') || code === '57P01') {
      throw new HttpError(503, `La base de données est momentanément injoignable. Aucun brouillon n’a été confirmé; réessaie dans quelques instants. Référence : ${reference}.`, 'database_unavailable')
    }
    if (code === '23505') {
      throw new HttpError(409, `Un événement portant une référence identique est en cours de création. Réessaie; aucun doublon n’a été confirmé. Référence : ${reference}.`, 'event_conflict')
    }
    if (code === '23503') {
      throw new HttpError(409, `L’organisation ou une donnée liée n’est plus disponible. Recharge la page, vérifie l’organisation sélectionnée puis réessaie. Référence : ${reference}.`, 'event_related_data_missing')
    }
    throw new HttpError(500, `Le brouillon n’a pas pu être enregistré. Aucun événement n’a été confirmé. Réessaie; si le problème persiste, transmets la référence ${reference} à l’assistance.`, 'event_creation_failed')
  }
})
