import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireTemplate } from '~~/server/utils/templates'
import { ticketTemplates } from '~~/server/db/schema'
export default api(async (e) => {
  const { template } = await requireTemplate(e, uuidParam(e, 'id'), 'template:write')
  const [t] = await useDb().insert(ticketTemplates).values({ organizationId: template.organizationId, name: `${template.name} (copie)`, draftLayout: template.draftLayout }).returning()
  return { id: t!.id }
})
