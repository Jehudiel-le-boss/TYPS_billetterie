import { z } from 'zod'
import { api, parseBody } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { ticketTemplates } from '~~/server/db/schema'
import { defaultLayout, sanitizeLayout } from '~~/shared/template'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const b = await parseBody(e, z.object({ organizationId: z.string().uuid(), name: z.string().trim().min(2).max(80), layout: z.any().optional() }))
  const { user } = await requireOrg(e, b.organizationId, 'template:write')
  const [t] = await useDb().insert(ticketTemplates).values({ organizationId: b.organizationId, name: b.name, draftLayout: b.layout ? sanitizeLayout(b.layout) : defaultLayout() }).returning()
  await audit(useDb(), { actorId: user.id, organizationId: b.organizationId, action: 'template.create', entityType: 'template', entityId: t!.id })
  return { id: t!.id }
})
