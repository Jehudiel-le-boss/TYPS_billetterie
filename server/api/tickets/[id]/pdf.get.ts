import { getQuery, setHeader } from 'h3'
import { api, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireTicketAccess } from '~~/server/utils/tickets-access'
import { ticketPdf } from '~~/server/services/ticket-render'
export default api(async (e) => {
  const id = uuidParam(e, 'id'); await requireTicketAccess(e, id); limit(e, 'pdf', 60, 300_000)
  const r = await ticketPdf(useDb(), id)
  setHeader(e, 'Content-Type', 'application/pdf'); setHeader(e, 'Content-Disposition', `${getQuery(e).dl ? 'attachment' : 'inline'}; filename="ticket-${r.ref}.pdf"`); setHeader(e, 'Cache-Control', 'private, no-store')
  return Buffer.from(r.bytes)
})
