import { setHeader } from 'h3'
import { api, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrderAccess } from '~~/server/utils/orders'
import { orderPdfs, sheetFrom } from '~~/server/services/ticket-render'
import { fail } from '~~/server/utils/errors'
// Planche A4 d'impression de tous les billets valides de la commande.
export default api(async (e) => {
  const id = uuidParam(e, 'id'); const { order } = await requireOrderAccess(e, id); limit(e, 'sheet', 20, 300_000)
  if (order.status !== 'paid') return fail(409, 'Commande non payée', 'not_paid')
  const pdfs = await orderPdfs(useDb(), id)
  if (!pdfs.length) return fail(404, 'Aucun billet valide', 'not_found')
  setHeader(e, 'Content-Type', 'application/pdf'); setHeader(e, 'Content-Disposition', `attachment; filename="planche-${id.slice(0, 8)}.pdf"`); setHeader(e, 'Cache-Control', 'private, no-store')
  return Buffer.from(await sheetFrom(pdfs))
})
