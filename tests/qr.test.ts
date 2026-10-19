import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { offlineDigest, qrContrastOk, qrPng, signTicketCode, verifyTicketCode } from '../server/utils/qr'
import { ticketRef } from '../server/utils/crypto'
const S = 'unit-test-secret-0123456789'
describe('QR signés', () => {
  it('aller-retour valide', () => { const id = randomUUID(); expect(verifyTicketCode(signTicketCode(id, 1, S), S)).toEqual({ ticketId: id, version: 1 }) })
  it('rejette toute altération (id, version, signature) et un autre secret', () => {
    const id = randomUUID(), c = signTicketCode(id, 1, S)
    expect(verifyTicketCode(c.replace(/\.1\./, '.2.'), S)).toBeNull()
    expect(verifyTicketCode(c.slice(0, -1) + (c.endsWith('A') ? 'B' : 'A'), S)).toBeNull()
    expect(verifyTicketCode(c, 'autre-secret-0123456789')).toBeNull()
    expect(verifyTicketCode(signTicketCode(randomUUID(), 1, S).replace(/^TYPS1\.[0-9a-f]{32}/, `TYPS1.${id.replace(/-/g, '')}`), S)).toBeNull()
    expect(verifyTicketCode('TY-ABCDEFGH', S)).toBeNull()
  })
  it('contient uniquement une référence opaque (aucune donnée personnelle)', () => expect(signTicketCode(randomUUID(), 1, S)).toMatch(/^TYPS1\.[0-9a-f]{32}\.1\.[A-Za-z0-9_-]{22}$/))
  it('deux billets d’une même commande ont des codes différents', () => { const set = new Set(Array.from({ length: 500 }, () => signTicketCode(randomUUID(), 1, S))); expect(set.size).toBe(500) })
  it('les références imprimées sont uniques à grande échelle', () => expect(new Set(Array.from({ length: 5000 }, ticketRef)).size).toBe(5000))
  it('une nouvelle version invalide l’ancien code (transfert)', () => { const id = randomUUID(); expect(signTicketCode(id, 1, S)).not.toBe(signTicketCode(id, 2, S)) })
  it('empreinte hors ligne stable et différente du code', () => { const c = signTicketCode(randomUUID(), 1, S); expect(offlineDigest(c)).toBe(offlineDigest(c)); expect(offlineDigest(c)).not.toContain(c.slice(6, 20)) })
  it('génère un PNG et contrôle la lisibilité', async () => { const b = await qrPng('TYPS1.test', { width: 300 }); expect(b.subarray(1, 4).toString()).toBe('PNG'); expect(qrContrastOk('#000000', '#ffffff')).toBe(true); expect(qrContrastOk('#777777', '#888888')).toBe(false); expect(qrContrastOk('#ffffff', '#000000')).toBe(false) })
})
