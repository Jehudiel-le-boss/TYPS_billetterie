import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireTicketAccess } from '~~/server/utils/tickets-access'
import { events, ticketTransfers } from '~~/server/db/schema'
import { emailSchema } from '~~/shared/validation'
import { randomToken, sha256 } from '~~/server/utils/crypto'
import { sendEmail, mailLayout } from '~~/server/services/mail'
import { env } from '~~/server/utils/env'
import { fail } from '~~/server/utils/errors'
import { requirePlatformFeature } from '~~/server/utils/feature-gates'
// Le transfert n'est effectif qu'à l'acceptation : l'ancien QR est alors invalidé (qr_version + 1) et un nouvel accès est créé.
export default api(async (e) => {
  await requirePlatformFeature(e, 'ticketTransfers')
  const t = await requireTicketAccess(e, uuidParam(e, 'id')); limit(e, 'transfer', 10, 3600_000)
  const [ev] = await useDb().select().from(events).where(eq(events.id, t.eventId)).limit(1)
  if (!ev?.transfersEnabled) return fail(403, 'Les transferts ne sont pas autorisés pour cet événement', 'transfers_disabled')
  if (t.status !== 'valid') return fail(409, 'Seul un billet valide peut être transféré', 'conflict')
  const b = await parseBody(e, z.object({ toEmail: emailSchema, toName: z.string().trim().min(2).max(120) }))
  const token = randomToken(32)
  await useDb().insert(ticketTransfers).values({ ticketId: t.id, fromEmail: t.holderEmail, toEmail: b.toEmail, toName: b.toName, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 72 * 3600_000) })
  void sendEmail(useDb(), b.toEmail, `Un billet vous est offert : ${ev.title}`, mailLayout('Vous avez reçu un billet', `Acceptez le transfert pour recevoir votre billet pour ${ev.title}. Le lien expire dans 72 h.`, { label: 'Accepter le billet', url: `${env.siteUrl()}/transfer/accept?token=${token}` }))
  return { ok: true }
})
