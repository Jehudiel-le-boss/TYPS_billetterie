// Intégration FedaPay via le SDK Node officiel (`fedapay`). Aucune signature ni endpoint réinventé.
// Docs : https://docs.fedapay.com — Transaction.create → generateToken (url de paiement) → Transaction.retrieve ; Webhook.constructEvent.
import { FedaPay, Transaction, Webhook } from 'fedapay'
import { env } from '../utils/env'
import { HttpError } from '../utils/errors'

export type ProviderStatus = 'pending' | 'approved' | 'declined' | 'canceled' | 'refunded' | 'failed'
export function mapStatus(s: string | undefined): ProviderStatus {
  if (!s) return 'pending'
  if (s === 'approved' || s === 'transferred') return 'approved'
  if (s.includes('refunded')) return 'refunded'
  if (s === 'declined') return 'declined'
  if (s === 'canceled') return 'canceled'
  return 'pending'
}
function configure() {
  const c = env.fedapay()
  if (!c.secretKey) throw new HttpError(503, 'FedaPay n’est pas configuré (clé secrète manquante)', 'fedapay_not_configured')
  FedaPay.setApiKey(c.secretKey)
  FedaPay.setEnvironment(c.mode)
  return c
}
export interface CreatePaymentInput { amount: number; currency: string; description: string; callbackUrl: string; customer: { name: string; email: string; phone?: string }; merchantReference: string; orderId: string }
export async function createPayment(i: CreatePaymentInput): Promise<{ txId: string; url: string }> {
  configure()
  const [first, ...rest] = i.customer.name.split(' ')
  const tx: any = await Transaction.create({
    description: i.description.slice(0, 200), amount: i.amount, currency: { iso: i.currency }, callback_url: i.callbackUrl,
    merchant_reference: i.merchantReference, custom_metadata: { order_id: i.orderId },
    customer: { firstname: first, lastname: rest.join(' ') || first, email: i.customer.email, ...(i.customer.phone ? { phone_number: { number: i.customer.phone, country: 'bj' } } : {}) }
  })
  const token: any = await tx.generateToken()
  if (!token?.url) throw new HttpError(502, 'FedaPay n’a pas renvoyé de lien de paiement', 'fedapay_no_url')
  return { txId: String(tx.id), url: String(token.url) }
}
export interface VerifiedTx { id: string; status: ProviderStatus; amount: number; currency: string; raw: unknown }
/** Vérification serveur-à-serveur : on ne croit JAMAIS la redirection ni le statut de l'URL de retour. */
export async function fetchTransaction(txId: string): Promise<VerifiedTx> {
  configure()
  const tx: any = await Transaction.retrieve(txId)
  return { id: String(tx.id), status: mapStatus(tx.status), amount: Number(tx.amount), currency: String(tx.currency?.iso ?? tx.currency_iso ?? ''), raw: JSON.parse(JSON.stringify(tx)) }
}
export interface WebhookEvent { name: string; entityId: string | null; payload: any; dedupeKey: string }
export function parseWebhook(rawBody: string, signatureHeader: string | undefined, secret = env.fedapay().webhookSecret): WebhookEvent {
  if (!secret) throw new HttpError(503, 'Secret webhook FedaPay non configuré', 'webhook_secret_missing')
  if (!signatureHeader) throw new HttpError(400, 'Signature absente', 'bad_signature')
  let payload: any
  try { payload = Webhook.constructEvent(rawBody, signatureHeader, secret) } catch { throw new HttpError(400, 'Signature invalide', 'bad_signature') }
  const entity = payload?.entity ?? payload?.object ?? null
  const entityId = entity?.id != null ? String(entity.id) : null
  const name = String(payload?.name ?? payload?.type ?? '')
  const stamp = payload?.id ?? entity?.updated_at ?? entity?.status ?? ''
  return { name, entityId, payload, dedupeKey: `fedapay:${name}:${entityId}:${stamp}` }
}
/** Remboursement : l'API publique n'est pas confirmée par le SDK ; l'opération reste manuelle (tableau FedaPay) et tracée dans `refunds`. */
export const REFUND_SUPPORTED = false
