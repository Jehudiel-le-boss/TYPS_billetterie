// Calculs financiers en entiers (unité la plus petite de la devise ; XOF n'a pas de décimales). Jamais de flottants.
export interface FeeConfig {
  platformPercentBp: number   // commission TYPS en points de base (100 bp = 1 %)
  platformFixedPerTicket: number
  providerPercentBp: number   // estimation des frais prestataire (config, pas une donnée FedaPay)
  providerFixed: number
  buyerPaysFees: boolean
}
export const ZERO_FEES: FeeConfig = { platformPercentBp: 0, platformFixedPerTicket: 0, providerPercentBp: 0, providerFixed: 0, buyerPaysFees: false }
export interface Amounts { subtotal: number; discount: number; taxable: number; platformFee: number; providerFee: number; buyerFees: number; total: number; organizerNet: number }

const pct = (amount: number, bp: number) => Math.floor((amount * bp + 5000) / 10000)

export function computeAmounts(subtotal: number, discount: number, tickets: number, cfg: FeeConfig): Amounts {
  if (![subtotal, discount, tickets, cfg.platformPercentBp, cfg.platformFixedPerTicket, cfg.providerPercentBp, cfg.providerFixed].every(Number.isInteger) || subtotal < 0 || discount < 0 || tickets < 0)
    throw new Error('Montants invalides : entiers positifs requis')
  const taxable = Math.max(0, subtotal - discount)
  if (taxable === 0) return { subtotal, discount: Math.min(discount, subtotal), taxable: 0, platformFee: 0, providerFee: 0, buyerFees: 0, total: 0, organizerNet: 0 }
  const platformFee = pct(taxable, cfg.platformPercentBp) + cfg.platformFixedPerTicket * tickets
  const providerFee = pct(taxable, cfg.providerPercentBp) + cfg.providerFixed
  if (cfg.buyerPaysFees) return { subtotal, discount, taxable, platformFee, providerFee, buyerFees: platformFee + providerFee, total: taxable + platformFee + providerFee, organizerNet: taxable }
  return { subtotal, discount, taxable, platformFee, providerFee, buyerFees: 0, total: taxable, organizerNet: Math.max(0, taxable - platformFee - providerFee) }
}
export function applyPromo(subtotal: number, kind: 'percent' | 'fixed', value: number): number {
  if (kind === 'percent') return Math.min(subtotal, pct(subtotal, Math.min(100, value) * 100))
  return Math.min(subtotal, value)
}
export const formatMoney = (amount: number, currency = 'XOF', locale = 'fr-FR') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'XOF' || currency === 'XAF' ? 0 : 2 }).format(amount)
