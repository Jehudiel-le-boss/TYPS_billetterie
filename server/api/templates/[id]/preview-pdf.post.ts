import { setHeader } from 'h3'
import { z } from 'zod'
import { api, limit, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireTemplate } from '~~/server/utils/templates'
import { renderTicketPdf } from '~~/server/services/pdf'
import { assetLoader } from '~~/server/services/ticket-render'
import { sanitizeLayout, type TicketContext } from '~~/shared/template'
import { signTicketCode } from '~~/server/utils/qr'

const previewContextSchema = z.object({
  eventTitle: z.string().max(140),
  holderName: z.string().max(120),
  category: z.string().max(80),
  ticketType: z.string().max(80).optional(),
  price: z.string().max(30),
  currency: z.string().max(8),
  ticketNumber: z.string().max(40),
  datetime: z.string().max(100),
  venue: z.string().max(200),
  orderId: z.string().max(40),
  vip: z.boolean(),
  accessTerms: z.string().max(1000),
  startsAt: z.string().max(40).optional(),
  timezone: z.string().max(60).optional(),
  demo: z.boolean().optional()
})

export default api(async (e) => {
  const { template, user } = await requireTemplate(e, uuidParam(e, 'id'), 'event:read')
  limit(e, 'tpl-pdf', 20, 300_000, user.id)
  const context: TicketContext = await parseBody(e, previewContextSchema)
  const db = useDb()
  const bytes = await renderTicketPdf(
    sanitizeLayout(template.draftLayout),
    context,
    signTicketCode('00000000-0000-4000-8000-000000000000', 1),
    assetLoader(db)
  )
  setHeader(e, 'Content-Type', 'application/pdf')
  setHeader(e, 'Content-Disposition', 'inline; filename="apercu-billet.pdf"')
  setHeader(e, 'Cache-Control', 'private, no-store')
  return Buffer.from(bytes)
})
