// Moteur PDF : rend le même JSON de gabarit que l'éditeur (coordonnées en px × 0.75 = pt).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { PX_TO_PT, resolveField, type PdfFont, type TemplateLayout, type TicketContext, type TplElement } from '../../shared/template'
import { qrPng } from '../utils/qr'

const hex = (h: string) => { const n = h.replace('#', ''); return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255) }
const FONT_MAP: Record<PdfFont, [StandardFonts, StandardFonts]> = { sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold], serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold], mono: [StandardFonts.Courier, StandardFonts.CourierBold] }
export type AssetLoader = (assetId: string) => Promise<{ bytes: Buffer; mime: string } | null>

function clean(font: PDFFont, s: string): string {
  const set = new Set(font.getCharacterSet())
  return [...s].map((ch) => (set.has(ch.codePointAt(0)!) ? ch : ch === '\n' ? ' ' : '?')).join('')
}
function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const lines: string[] = []; let line = ''
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(t, size) <= maxW || !line) line = t; else { lines.push(line); line = w }
  }
  if (line) lines.push(line); return lines
}
function roundedPath(w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
}
async function embedImage(doc: PDFDocument, a: { bytes: Buffer; mime: string }): Promise<PDFImage> { return a.mime === 'image/png' ? doc.embedPng(a.bytes) : doc.embedJpg(a.bytes) }

export async function renderTicketPdf(layout: TemplateLayout, ctx: TicketContext, qrPayload: string, loadAsset: AssetLoader = async () => null): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const W = layout.width * PX_TO_PT, H = layout.height * PX_TO_PT
  const page = doc.addPage([W, H])
  const fonts = new Map<string, PDFFont>()
  const getFont = async (f: PdfFont, bold: boolean) => { const k = `${f}:${bold}`; if (!fonts.has(k)) fonts.set(k, await doc.embedFont(FONT_MAP[f][bold ? 1 : 0])); return fonts.get(k)! }
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: hex(layout.background.color) })
  if (layout.background.assetId) {
    const a = await loadAsset(layout.background.assetId)
    if (a) { const img = await embedImage(doc, a); page.drawImage(img, { x: 0, y: 0, width: W, height: H }) }
  }
  for (const el of layout.elements) if (!el.hidden) await drawElement(doc, page, el, ctx, qrPayload, layout.height, getFont, loadAsset)
  if (ctx.demo) { const f = await getFont('sans', true); page.drawText('DEMO — NON VALABLE', { x: 8, y: 6, size: 8, font: f, color: rgb(1, 0.3, 0.3), opacity: 0.9 }) }
  return doc.save()
}
async function drawElement(doc: PDFDocument, page: PDFPage, el: TplElement, ctx: TicketContext, qr: string, layoutH: number, getFont: (f: PdfFont, b: boolean) => Promise<PDFFont>, loadAsset: AssetLoader) {
  const x = el.x * PX_TO_PT, w = el.w * PX_TO_PT, h = el.h * PX_TO_PT, yTop = (layoutH - el.y) * PX_TO_PT, y = yTop - h
  if (el.type === 'shape') {
    const o = { opacity: el.opacity, borderOpacity: el.opacity }
    if (el.shape === 'ellipse') page.drawEllipse({ x: x + w / 2, y: y + h / 2, xScale: w / 2, yScale: h / 2, color: hex(el.fill), borderColor: el.strokeWidth ? hex(el.stroke) : undefined, borderWidth: el.strokeWidth * PX_TO_PT, ...o })
    else if (el.radius > 0) page.drawSvgPath(roundedPath(w, h, el.radius * PX_TO_PT), { x, y: yTop, color: hex(el.fill), borderColor: el.strokeWidth ? hex(el.stroke) : undefined, borderWidth: el.strokeWidth * PX_TO_PT, ...o })
    else page.drawRectangle({ x, y, width: w, height: h, color: hex(el.fill), borderColor: el.strokeWidth ? hex(el.stroke) : undefined, borderWidth: el.strokeWidth * PX_TO_PT, ...o })
  } else if (el.type === 'qr') {
    const png = await doc.embedPng(await qrPng(qr, { fg: el.fg, bg: el.bg, quiet: el.quiet, width: 1000 }))
    const s = Math.min(w, h); page.drawImage(png, { x: x + (w - s) / 2, y: y + (h - s) / 2, width: s, height: s, opacity: el.opacity })
  } else if (el.type === 'image') {
    const a = await loadAsset(el.assetId); if (!a) return
    const img = await embedImage(doc, a); const r = el.fit === 'cover' ? Math.max(w / img.width, h / img.height) : Math.min(w / img.width, h / img.height)
    page.drawImage(img, { x: x + (w - img.width * r) / 2, y: y + (h - img.height * r) / 2, width: img.width * r, height: img.height * r, opacity: el.opacity })
  } else {
    const raw = el.type === 'text' ? el.text : (el.prefix ?? '') + resolveField(el.field, ctx); if (!raw) return
    const font = await getFont(el.font, el.bold), size = el.fontSize * PX_TO_PT, lh = size * 1.2
    const lines = wrap(font, clean(font, raw), size, w).slice(0, Math.max(1, Math.floor(h / lh)))
    lines.forEach((ln, i) => {
      const tw = font.widthOfTextAtSize(ln, size), tx = el.align === 'center' ? x + (w - tw) / 2 : el.align === 'right' ? x + w - tw : x
      page.drawText(ln, { x: tx, y: yTop - i * lh - (lh - size * 0.925) / 2 - size * 0.718, size, font, color: hex(el.color), opacity: el.opacity })
    })
  }
}
/** Planche d'impression A4 : plusieurs billets par page, rendus par incorporation de pages PDF (identiques au billet individuel). */
export async function renderSheetPdf(pages: Uint8Array[], ticketW: number, ticketH: number): Promise<Uint8Array> {
  const sheet = await PDFDocument.create()
  const PW = 595.28, PH = 841.89, M = 28, GAP = 10
  const w = PW - 2 * M, scale = w / (ticketW * PX_TO_PT), h = ticketH * PX_TO_PT * scale
  const perPage = Math.max(1, Math.floor((PH - 2 * M + GAP) / (h + GAP)))
  let page = sheet.addPage([PW, PH]), n = 0
  for (const bytes of pages) {
    if (n && n % perPage === 0) page = sheet.addPage([PW, PH])
    const [emb] = await sheet.embedPdf(bytes)
    const slot = n % perPage; page.drawPage(emb!, { x: M, y: PH - M - (slot + 1) * h - slot * GAP, width: w, height: h })
    page.drawRectangle({ x: M, y: PH - M - (slot + 1) * h - slot * GAP, width: w, height: h, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.4, borderDashArray: [3, 3] })
    n++
  }
  return sheet.save()
}
