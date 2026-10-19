import { inArray } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireTicketAccess } from '~~/server/utils/tickets-access'
import { buildContext } from '~~/server/services/ticket-render'
import { ticketTemplateAssets } from '~~/server/db/schema'
import { signedUrl } from '~~/server/services/storage'
import { fail } from '~~/server/utils/errors'
// Données de rendu du billet numérique (mobile) : même gabarit JSON que le PDF + code QR signé ; le client dessine le QR.
export default api(async (e) => {
  const id = uuidParam(e, 'id'); await requireTicketAccess(e, id)
  const b = await buildContext(useDb(), id)
  if (!b) return fail(404, 'Billet introuvable', 'not_found')
  const ids = [b.layout.background.assetId, ...b.layout.elements.map((x) => (x.type === 'image' ? x.assetId : null))].filter(Boolean) as string[]
  const assets = ids.length ? await useDb().select().from(ticketTemplateAssets).where(inArray(ticketTemplateAssets.id, ids)) : []
  const urls: Record<string, string> = {}; for (const a of assets) urls[a.id] = await signedUrl(a.storageKey, 3600)
  return { layout: b.layout, ctx: b.ctx, code: b.ticket.status === 'valid' || b.ticket.status === 'used' ? b.code : null, status: b.ticket.status, assetUrls: urls, ref: b.ticket.ref }
})
