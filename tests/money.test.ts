import { describe, expect, it } from 'vitest'
import { applyPromo, computeAmounts, ZERO_FEES } from '../shared/money'
describe('montants entiers', () => {
  it('sans frais : total = sous-total − remise', () => { const a = computeAmounts(30000, 5000, 3, ZERO_FEES); expect(a.total).toBe(25000); expect(a.organizerNet).toBe(25000) })
  it('frais à la charge de l’acheteur : total augmenté, net organisateur intact', () => {
    const a = computeAmounts(10000, 0, 2, { platformPercentBp: 500, platformFixedPerTicket: 100, providerPercentBp: 200, providerFixed: 0, buyerPaysFees: true })
    expect(a).toMatchObject({ platformFee: 700, providerFee: 200, buyerFees: 900, total: 10900, organizerNet: 10000 })
  })
  it('frais absorbés par l’organisateur : le net baisse, le total ne change pas', () => {
    const a = computeAmounts(10000, 0, 1, { platformPercentBp: 500, platformFixedPerTicket: 0, providerPercentBp: 0, providerFixed: 0, buyerPaysFees: false })
    expect(a.total).toBe(10000); expect(a.organizerNet).toBe(9500)
  })
  it('commande gratuite : aucun frais', () => expect(computeAmounts(0, 0, 2, { ...ZERO_FEES, platformFixedPerTicket: 100 })).toMatchObject({ total: 0, platformFee: 0 }))
  it('arrondi entier, jamais de flottant', () => expect(Number.isInteger(computeAmounts(3333, 0, 1, { ...ZERO_FEES, platformPercentBp: 333 }).platformFee)).toBe(true))
  it('refuse les flottants', () => expect(() => computeAmounts(10.5, 0, 1, ZERO_FEES)).toThrow())
  it('promo plafonnée au sous-total', () => { expect(applyPromo(5000, 'fixed', 9000)).toBe(5000); expect(applyPromo(20000, 'percent', 15)).toBe(3000) })
})
