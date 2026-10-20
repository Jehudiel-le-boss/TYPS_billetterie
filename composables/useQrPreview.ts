import QRCode from 'qrcode'
import type { TemplateLayout } from '~~/shared/template'
export const SAMPLE_QR = `TYPS1.${'0'.repeat(32)}.1.${'A'.repeat(22)}`
const cache = new Map<string, string>()
export async function qrFor(text: string, fg = '#000000', bg = '#ffffff', quiet = true) {
  const k = `${text}|${fg}|${bg}|${quiet}`; if (cache.has(k)) return cache.get(k)!
  const u = await QRCode.toDataURL(text, { errorCorrectionLevel: 'Q', margin: quiet ? 2 : 0, width: 480, color: { dark: fg, light: bg } }); cache.set(k, u); return u
}
export async function qrMapFor(layout: TemplateLayout, text = SAMPLE_QR): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const el of layout.elements) if (el.type === 'qr') out[el.id] = await qrFor(text, el.fg, el.bg, el.quiet)
  return out
}
const luminance = (h: string) => { const n = h.replace('#', ''); const [r, g, bl] = [0, 2, 4].map((i) => { const c = parseInt(n.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl! }
export function contrastRatio(a: string, b: string) { const [x, y] = [luminance(a), luminance(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export function qrContrastOk(fg: string, bg: string) { return contrastRatio(fg, bg) >= 4 && luminance(fg) < luminance(bg) }
export async function decodeQrDataUrl(url: string): Promise<string | null> {
  const jsQR = (await import('jsqr')).default
  const img = new Image(); img.src = url; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d')!; x.drawImage(img, 0, 0)
  return jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data ?? null
}
