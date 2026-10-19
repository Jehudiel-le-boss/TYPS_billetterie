import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { events } from '~~/server/db/schema'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const admin = await requirePlatformAdmin(e); const id = uuidParam(e, 'id')
  const b = await parseBody(e, z.object({ moderation: z.enum(['ok', 'flagged', 'removed']), note: z.string().max(300).optional() }))
  await useDb().update(events).set({ moderation: b.moderation, ...(b.moderation !== 'ok' && { status: 'suspended' as const }) }).where(eq(events.id, id))
  await audit(useDb(), { actorId: admin.id, action: 'admin.event.moderate', entityType: 'event', entityId: id, meta: b })
  return { ok: true }
})
