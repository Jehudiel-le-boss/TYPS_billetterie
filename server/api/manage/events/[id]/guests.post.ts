import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { parseGuestsCsv } from '~~/server/services/csv'
import { issueGuestInvitations } from '~~/server/services/guests'
import { sendEmail, mailLayout } from '~~/server/services/mail'
import { env } from '~~/server/utils/env'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
// Import CSV : sans `commit`, renvoie un aperçu (lignes valides + erreurs) ; avec `commit`, émet les invitations.
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'guest:manage')
  const b = await parseBody(e, z.object({ csv: z.string().max(400_000), listName: z.string().trim().min(2).max(80).default('Invités'), kind: z.enum(['vip', 'press', 'partner', 'free']).default('vip'), categoryId: z.string().uuid().optional(), commit: z.boolean().default(false) }))
  const preview = parseGuestsCsv(b.csv)
  if (!b.commit) return { ...preview, rows: preview.rows.slice(0, 50) }
  if (!b.categoryId) return fail(422, 'Choisissez la catégorie des billets invités', 'validation')
  if (preview.errors.length) return fail(422, 'Corrigez les erreurs du fichier avant de valider', 'csv_errors', { errors: preview.errors.slice(0, 20) })
  if (!preview.rows.length || preview.rows.length > 200) return fail(422, 'Entre 1 et 200 invités par import', 'validation')
  const r = await issueGuestInvitations(useDb(), { eventId: event.id, categoryId: b.categoryId, listName: b.listName, kind: b.kind, guests: preview.rows, actorId: user.id })
  for (const g of r.links) if (g.email) void sendEmail(useDb(), g.email, `Votre invitation : ${event.title}`, mailLayout(`Vous êtes invité(e)`, `Votre billet pour ${event.title} est prêt.`, { label: 'Voir mon billet', url: `${env.siteUrl()}/orders/${g.orderId}?k=${g.k}` }))
  await audit(useDb(), { actorId: user.id, organizationId: event.organizationId, action: 'guests.import', entityType: 'guest_list', entityId: r.listId, meta: { count: r.links.length } })
  return { listId: r.listId, issued: r.links.length, links: r.links.filter((l) => !l.email).map((l) => ({ name: l.name, url: `/orders/${l.orderId}?k=${l.k}` })) }
})
