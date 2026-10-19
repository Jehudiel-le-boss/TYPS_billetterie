import { describe, expect, it } from 'vitest'
import { applyPromo, computeAmounts, ZERO_FEES } from '../shared/money'
describe('montants entiers', () => {
  it('sans frais : total = sous-total − remise', () => { const a = computeAmounts(30000, 5000, 3, ZERO_FEES); expect(a.total).toBe(25000); expect(a.organizerNet).toBe(25000) })
  it('frais à la charge de l’acheteur : total augmenté, net organisateur intact', () => {
    const a = computeAmounts(10000, 0, 2, { platformFeeEnabled: true, platformPercentBp: 500, platformFixedPerTicket: 100, providerFeeEnabled: true, providerPercentBp: 200, providerFixed: 0, buyerPaysFees: true })
    expect(a).toMatchObject({ platformFee: 700, providerFee: 200, buyerFees: 900, total: 10900, organizerNet: 10000 })
  })
  it('frais absorbés par l’organisateur : le net baisse, le total ne change pas', () => {
    const a = computeAmounts(10000, 0, 1, { platformFeeEnabled: true, platformPercentBp: 500, platformFixedPerTicket: 0, providerFeeEnabled: false, providerPercentBp: 0, providerFixed: 0, buyerPaysFees: false })
    expect(a.total).toBe(10000); expect(a.organizerNet).toBe(9500)
  })
  it('désactive les commissions même si des montants sont configurés', () => {
    const a = computeAmounts(10000, 0, 2, { ...ZERO_FEES, platformPercentBp: 500, platformFixedPerTicket: 100, providerPercentBp: 200, providerFixed: 50 })
    expect(a).toMatchObject({ platformFee: 0, providerFee: 0, buyerFees: 0, total: 10000, organizerNet: 10000 })
  })
  it('désactive seulement les frais prestataire sans désactiver la commission TYPS', () => {
    const a = computeAmounts(10000, 0, 1, { ...ZERO_FEES, platformFeeEnabled: true, platformPercentBp: 500, providerPercentBp: 300, providerFixed: 50 })
    expect(a).toMatchObject({ platformFee: 500, providerFee: 0, organizerNet: 9500 })
  })
  it('commande gratuite : aucun frais', () => expect(computeAmounts(0, 0, 2, { ...ZERO_FEES, platformFeeEnabled: true, platformFixedPerTicket: 100 })).toMatchObject({ total: 0, platformFee: 0 }))
  it('arrondi entier, jamais de flottant', () => expect(Number.isInteger(computeAmounts(3333, 0, 1, { ...ZERO_FEES, platformFeeEnabled: true, platformPercentBp: 333 }).platformFee)).toBe(true))
  it('refuse les flottants', () => expect(() => computeAmounts(10.5, 0, 1, ZERO_FEES)).toThrow())
  it('promo plafonnée au sous-total', () => { expect(applyPromo(5000, 'fixed', 9000)).toBe(5000); expect(applyPromo(20000, 'percent', 15)).toBe(3000) })
})
