import { getQuery, setHeader } from 'h3'
import { api, uuidParam } from '~~/server/utils/api'
import { requireTicketAccess } from '~~/server/utils/tickets-access'
import { signTicketCode, qrPng } from '~~/server/utils/qr'
import { fail } from '~~/server/utils/errors'
// QR haute résolution (?size=1200 pour l'impression). Ne contient qu'une référence signée.
export default api(async (e) => {
  const id = uuidParam(e, 'id'); const t = await requireTicketAccess(e, id)
  if (t.status !== 'valid' && t.status !== 'used') return fail(410, 'Billet non valide', 'gone')
  const size = Math.min(2400, Math.max(200, Number(getQuery(e).size) || 600))
  setHeader(e, 'Content-Type', 'image/png'); setHeader(e, 'Cache-Control', 'private, no-store')
  return qrPng(signTicketCode(t.id, t.qrVersion), { width: size })
})
