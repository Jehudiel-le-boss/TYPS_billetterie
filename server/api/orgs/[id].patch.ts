import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { auditLogs, organizations } from '~~/server/db/schema'

export default api(async (e) => {
  const orgId = uuidParam(e, 'id')
  const { user } = await requireOrg(e, orgId, 'org:manage')
  const body = await parseBody(e, z.object({ name: z.string().trim().min(2).max(100) }))
  const db = useDb()
  const organization = await db.transaction(async (tx) => {
    const [updated] = await tx.update(organizations).set({ name: body.name })
      .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt))).returning()
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Organisation introuvable' })
    await tx.insert(auditLogs).values({
      actorId: user.id,
      organizationId: orgId,
      action: 'org.update',
      entityType: 'organization',
      entityId: orgId,
      meta: { name: body.name }
    })
    return updated
  })
  return organization
})
