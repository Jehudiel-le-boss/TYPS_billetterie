import { api, parseBody, uuidParam, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { physicalSaleSchema } from '~~/shared/validation'
import { getFeeConfig } from '~~/server/services/settings'
import { createPhysicalSale } from '~~/server/services/checkout'
import { audit } from '~~/server/utils/audit'
import { requirePlatformFeature } from '~~/server/utils/feature-gates'
import { notifyOrganizationManagers } from '~~/server/services/notifications'
import { sendEmailWithStatus, mailLayout, type EmailDelivery } from '~~/server/services/mail'
import { env } from '~~/server/utils/env'
export default api(async (e) => {
  await requirePlatformFeature(e, 'physicalSales')
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'sales:create_physical')
  limit(e, 'door-sale', 120, 60_000, user.id)
  const b = await parseBody(e, physicalSaleSchema)
  const db = useDb()
  const r = await createPhysicalSale(db, { ...b, eventId: event.id, sellerId: user.id }, await getFeeConfig(db))
  const ticketUrl = `${env.siteUrl()}/orders/${r.order.id}?k=${encodeURIComponent(r.accessToken)}`
  let emailSent: boolean | null = null
  let emailError = false
  let emailDelivery: EmailDelivery | null = null
  if (b.buyerEmail) {
    try {
      emailDelivery = await sendEmailWithStatus(db, b.buyerEmail, `Vos billets pour ${event.title}`, mailLayout('Vos billets sont prêts', 'Votre commande au guichet est confirmée. Ouvrez ce lien sécurisé pour consulter et télécharger vos billets.', { label: 'Voir mes billets', url: ticketUrl }))
      emailSent = emailDelivery.status === 'sent'
    } catch (error) {
      emailSent = false
      emailDelivery = { status: 'error', reason: 'Erreur lors de la préparation de l’envoi.' }
      emailError = true
      console.error('[door-sale.email] Could not send ticket link', { errorName: error instanceof Error ? error.name : 'UnknownError' })
    }
  }
  if (!event.isDemo) await notifyOrganizationManagers(db, event.organizationId, { kind: 'sale_physical', title: 'Vente au guichet enregistrée', body: `${r.tickets.length} billet(s) vendu(s) pour ${event.title}.`, href: `/app/events/${event.id}?tab=commandes` })
  await audit(db, { actorId: user.id, organizationId: event.organizationId, action: 'sale.physical', entityType: 'order', entityId: r.order.id, meta: { method: b.paymentMethod, total: r.order.total, tickets: r.tickets.length } })
  return { orderId: r.order.id, k: r.accessToken, ticketUrl, emailSent, emailError, emailDelivery, total: r.order.total, change: b.amountReceived - r.order.total, currency: r.order.currency, tickets: r.tickets.map((t) => ({ id: t.id, ref: t.ref })) }
})
