import { describe, expect, it } from 'vitest'
import { Webhook } from 'fedapay'
import { mapStatus, parseWebhook } from '../server/services/fedapay'
const SECRET = 'wh_test_secret'
const body = JSON.stringify({ id: 'evt_1', name: 'transaction.approved', entity: { id: 12345, status: 'approved', amount: 10000 } })
const header = (p = body, secret = SECRET) => (Webhook as any).generateTestHeaderString({ payload: p, secret })
describe('webhook FedaPay (signature via SDK officiel)', () => {
  it('accepte une signature valide et extrait la transaction', () => { const e = parseWebhook(body, header(), SECRET); expect(e.name).toBe('transaction.approved'); expect(e.entityId).toBe('12345'); expect(e.dedupeKey).toContain('12345') })
  it('rejette une signature falsifiée, un corps modifié, un mauvais secret, une absence', () => {
    expect(() => parseWebhook(body, 'ts=1,v1=deadbeef', SECRET)).toThrow()
    expect(() => parseWebhook(body.replace('10000', '1'), header(), SECRET)).toThrow()
    expect(() => parseWebhook(body, header(body, 'autre'), SECRET)).toThrow()
    expect(() => parseWebhook(body, undefined, SECRET)).toThrow()
  })
  it('rejouer le même webhook donne la même clé de déduplication', () => expect(parseWebhook(body, header(), SECRET).dedupeKey).toBe(parseWebhook(body, header(), SECRET).dedupeKey))
  it('statuts', () => { expect(mapStatus('approved')).toBe('approved'); expect(mapStatus('declined')).toBe('declined'); expect(mapStatus('canceled')).toBe('canceled'); expect(mapStatus('pending')).toBe('pending'); expect(mapStatus(undefined)).toBe('pending') })
})
