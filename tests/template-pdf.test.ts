import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { defaultLayout, resolveField, sanitizeLayout, SAMPLE_CONTEXT } from '../shared/template'
import { renderSheetPdf, renderTicketPdf } from '../server/services/pdf'
import { signTicketCode } from '../server/utils/qr'
describe('gabarit + PDF', () => {
  it('les champs dynamiques sont remplacés par les vraies valeurs', () => { expect(resolveField('holder_name', SAMPLE_CONTEXT)).toBe('Aïcha Dossou'); expect(resolveField('vip_badge', { ...SAMPLE_CONTEXT, vip: false })).toBe('') })
  it('sanitizeLayout borne les valeurs et refuse un JSON invalide', () => {
    expect(() => sanitizeLayout({ v: 2 })).toThrow()
    const l = defaultLayout(); l.width = 99999; (l.elements[1] as any).color = 'javascript:alert(1)'
    const s = sanitizeLayout(l); expect(s.width).toBe(2400); expect((s.elements[1] as any).color).toBe('#ffffff')
  })
  it('génère un PDF valide à la bonne taille (px × 0,75), accents inclus', async () => {
    const bytes = await renderTicketPdf(defaultLayout(), { ...SAMPLE_CONTEXT, holderName: 'Zoé Ñandú — 🎉' }, signTicketCode('11111111-1111-4111-8111-111111111111', 1, 'unit-test-secret-0123456789'))
    expect(Buffer.from(bytes.subarray(0, 4)).toString()).toBe('%PDF')
    const doc = await PDFDocument.load(bytes); const p = doc.getPage(0)
    expect(Math.round(p.getWidth())).toBe(675); expect(Math.round(p.getHeight())).toBe(270)
  })
  it('planche A4 : plusieurs billets par page', async () => {
    const one = await renderTicketPdf(defaultLayout(), SAMPLE_CONTEXT, 'TYPS1.x')
    const sheet = await PDFDocument.load(await renderSheetPdf(Array(7).fill(one), 900, 360))
    expect(sheet.getPageCount()).toBeGreaterThanOrEqual(1); expect(sheet.getPageCount()).toBeLessThan(7)
  })
})
