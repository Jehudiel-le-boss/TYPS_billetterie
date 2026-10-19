import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseQuery } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { ticketTemplates } from '~~/server/db/schema'
export default api(async (e) => {
  const { orgId } = parseQuery(e, z.object({ orgId: z.string().uuid() })); await requireOrg(e, orgId, 'event:read')
  return useDb().select({ id: ticketTemplates.id, name: ticketTemplates.name, updatedAt: ticketTemplates.updatedAt, published: ticketTemplates.currentVersionId, isPremium: ticketTemplates.isPremium }).from(ticketTemplates).where(and(eq(ticketTemplates.organizationId, orgId), isNull(ticketTemplates.deletedAt))).orderBy(desc(ticketTemplates.updatedAt))
})
