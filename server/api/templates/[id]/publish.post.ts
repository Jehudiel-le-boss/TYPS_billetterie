import { eq, sql } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireTemplate } from '~~/server/utils/templates'
import { ticketTemplates, ticketTemplateVersions } from '~~/server/db/schema'
import { sanitizeLayout } from '~~/shared/template'
import { qrContrastOk } from '~~/server/utils/qr'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
// Publier = figer une version immuable utilisée par les billets émis ensuite. Vérifie la présence et la lisibilité du QR.
export default api(async (e) => {
  const { template, user } = await requireTemplate(e, uuidParam(e, 'id'), 'template:write')
  const layout = sanitizeLayout(template.draftLayout)
  const qr = layout.elements.find((x) => x.type === 'qr' && !x.hidden)
  if (!qr || qr.type !== 'qr') return fail(422, 'Ajoutez un QR code au billet avant de publier', 'no_qr')
  if (!qrContrastOk(qr.fg, qr.bg)) return fail(422, 'Contraste du QR insuffisant (ratio 4:1 requis, modules plus sombres que le fond)', 'qr_contrast')
  if (Math.min(qr.w, qr.h) < 90) return fail(422, 'QR trop petit : 90 px minimum pour une lecture fiable', 'qr_small')
  const db = useDb()
  const v = await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: sql<number>`coalesce(max(${ticketTemplateVersions.version}), 0)::int` }).from(ticketTemplateVersions).where(eq(ticketTemplateVersions.templateId, template.id)) as [{ n: number }]
    const [row] = await tx.insert(ticketTemplateVersions).values({ templateId: template.id, version: n + 1, layout, createdBy: user.id }).returning()
    await tx.update(ticketTemplates).set({ currentVersionId: row!.id, updatedAt: new Date() }).where(eq(ticketTemplates.id, template.id))
    return row!
  })
  await audit(db, { actorId: user.id, organizationId: template.organizationId, action: 'template.publish', entityType: 'template', entityId: template.id, meta: { version: v.version } })
  return { version: v.version }
})
