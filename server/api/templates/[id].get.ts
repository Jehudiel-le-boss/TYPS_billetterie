import { api, uuidParam } from '~~/server/utils/api'
import { requireTemplate } from '~~/server/utils/templates'
import { sanitizeLayout } from '~~/shared/template'
export default api(async (e) => { const { template: t } = await requireTemplate(e, uuidParam(e, 'id'), 'event:read'); return { id: t.id, name: t.name, organizationId: t.organizationId, layout: sanitizeLayout(t.draftLayout), published: !!t.currentVersionId, updatedAt: t.updatedAt } })
