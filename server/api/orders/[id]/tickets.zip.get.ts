import { setHeader } from 'h3'
import { zipSync } from 'fflate'
import { api, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrderAccess } from '~~/server/utils/orders'
import { orderPdfs } from '~~/server/services/ticket-render'
import { fail } from '~~/server/utils/errors'
export default api(async (e) => {
  const id = uuidParam(e, 'id'); const { order } = await requireOrderAccess(e, id); limit(e, 'zip', 10, 300_000)
  if (order.status !== 'paid') return fail(409, 'Commande non payée', 'not_paid')
  const pdfs = await orderPdfs(useDb(), id)
  if (!pdfs.length) return fail(404, 'Aucun billet valide', 'not_found')
  const files: Record<string, Uint8Array> = {}; pdfs.forEach((p) => { files[`ticket-${p.ref}.pdf`] = p.bytes })
  setHeader(e, 'Content-Type', 'application/zip'); setHeader(e, 'Content-Disposition', `attachment; filename="billets-${id.slice(0, 8)}.zip"`); setHeader(e, 'Cache-Control', 'private, no-store')
  return Buffer.from(zipSync(files, { level: 0 }))
})
