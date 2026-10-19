import { setHeader } from 'h3'
import { api, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireTemplate } from '~~/server/utils/templates'
import { renderTicketPdf } from '~~/server/services/pdf'
import { assetLoader } from '~~/server/services/ticket-render'
import { sanitizeLayout, SAMPLE_CONTEXT } from '~~/shared/template'
import { signTicketCode } from '~~/server/utils/qr'
// PDF d'essai (données fictives) généré par le même moteur que les vrais billets : permet de vérifier l'export avant publication.
export default api(async (e) => {
  const { template, user } = await requireTemplate(e, uuidParam(e, 'id'), 'template:write'); limit(e, 'tpl-pdf', 20, 300_000, user.id)
  const bytes = await renderTicketPdf(sanitizeLayout(template.draftLayout), SAMPLE_CONTEXT, signTicketCode('00000000-0000-4000-8000-000000000000', 1), assetLoader(useDb()))
  setHeader(e, 'Content-Type', 'application/pdf'); setHeader(e, 'Content-Disposition', 'inline; filename="apercu-billet.pdf"'); setHeader(e, 'Cache-Control', 'private, no-store')
  return Buffer.from(bytes)
})
