import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { defaultLayout, elementNameLabel, elementTypeLabel, resolveField, sanitizeLayout, SAMPLE_CONTEXT, ticketTypeLabel } from '../shared/template'
import { renderSheetPdf, renderTicketPdf } from '../server/services/pdf'
import { signTicketCode } from '../server/utils/qr'
describe('gabarit + PDF', () => {
  it('les champs dynamiques sont remplacés par les vraies valeurs et les exemples restent génériques', () => { expect(resolveField('holder_name', SAMPLE_CONTEXT)).toBe('Participant exemple'); expect(resolveField('vip_badge', { ...SAMPLE_CONTEXT, vip: false })).toBe('') })
  it('rend le type de billet à part de sa catégorie et garde le repli des anciens contextes', () => {
    expect(resolveField('ticket_type', { ...SAMPLE_CONTEXT, ticketType: 'Premium' })).toBe('Premium')
    expect(resolveField('ticket_type', { ...SAMPLE_CONTEXT, ticketType: undefined })).toBe(SAMPLE_CONTEXT.category)
    expect(ticketTypeLabel('vip', 'Entrée')).toBe('VIP')
    expect(ticketTypeLabel('custom', 'Accès terrasse')).toBe('Accès terrasse')
  })
  it('garde le type réel d’un calque distinct de son nom personnalisé', () => {
    const qr = defaultLayout().elements.find((element) => element.type === 'qr')
    expect(qr).toBeDefined()
    if (!qr) return
    expect(elementTypeLabel(qr)).toBe('QR code')
    expect(elementNameLabel({ ...qr, name: 'Entrée principale' })).toBe('Entrée principale')
    expect(elementTypeLabel({ ...qr, name: 'Entrée principale' })).toBe('QR code')
  })
  it('formate la date du billet selon le choix du modèle', () => {
    const context = { ...SAMPLE_CONTEXT, startsAt: '2026-12-12T20:00:00+01:00', timezone: 'Africa/Porto-Novo' }
    expect(resolveField('datetime', context, 'date')).toMatch(/12 décembre 2026/)
    expect(resolveField('datetime', context, 'time')).toBe('20:00')
    expect(resolveField('datetime', context, 'default')).toBe(SAMPLE_CONTEXT.datetime)
  })
  it('génère un PDF valide avec toutes les variantes de typographie', async () => {
    for (const font of ['sans', 'sans_italic', 'serif', 'serif_italic', 'mono', 'mono_italic'] as const) {
      const layout = defaultLayout()
      const title = layout.elements.find((el) => el.type === 'field' && el.field === 'event_title')
      if (title?.type === 'field') { title.font = font; title.bold = true }
      const pdf = await renderTicketPdf(layout, SAMPLE_CONTEXT, 'TYPS1.x')
      await expect(PDFDocument.load(pdf)).resolves.toBeTruthy()
    }
  })
  it('sanitizeLayout borne les valeurs et refuse un JSON invalide', () => {
    expect(() => sanitizeLayout({ v: 2 })).toThrow()
    const l = defaultLayout(); l.width = 99999; (l.elements[1] as any).color = 'javascript:alert(1)'; (l.elements[1] as any).font = 'unexpected'; (l.elements[3] as any).dateFormat = 'unexpected'
    const s = sanitizeLayout(l); expect(s.width).toBe(2400); expect((s.elements[1] as any).color).toBe('#ffffff'); expect((s.elements[1] as any).font).toBe('sans'); expect((s.elements[3] as any).dateFormat).toBe('default')
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
