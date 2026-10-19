import QRCode from 'qrcode'
import { hmac, safeEqual, sha256 } from './crypto'
import { env } from './env'

/** Contenu du QR : référence opaque signée (HMAC-SHA256, 128 bits). Aucune donnée personnelle. Validée côté serveur. */
export function signTicketCode(ticketId: string, version: number, secret = env.qrSecret()): string {
  const compact = ticketId.replace(/-/g, '')
  return `TYPS1.${compact}.${version}.${hmac(secret, `${compact}.${version}`).slice(0, 22)}`
}
export interface ParsedCode { ticketId: string; version: number }
export function verifyTicketCode(code: string, secret = env.qrSecret()): ParsedCode | null {
  const m = /^TYPS1\.([0-9a-f]{32})\.(\d{1,6})\.([A-Za-z0-9_-]{22})$/.exec(code.trim())
  if (!m) return null
  const [, compact, ver, sig] = m
  if (!safeEqual(hmac(secret, `${compact}.${ver}`).slice(0, 22), sig!)) return null
  const c = compact!
  return { ticketId: `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`, version: Number(ver) }
}
/** Empreinte utilisée par le pack hors ligne : l'appareil ne reçoit jamais le secret de signature. */
export const offlineDigest = (code: string) => sha256(code.trim()).slice(0, 24)

export interface QrOptions { fg?: string; bg?: string; quiet?: boolean; width?: number }
export async function qrPng(payload: string, o: QrOptions = {}): Promise<Buffer> {
  return QRCode.toBuffer(payload, { type: 'png', errorCorrectionLevel: 'Q', margin: o.quiet === false ? 0 : 2, width: o.width ?? 600, color: { dark: o.fg ?? '#000000', light: o.bg ?? '#ffffff' } })
}
export async function qrDataUrl(text: string, width = 360): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 2, width, color: { dark: '#000000', light: '#ffffff' } })
}
/** Lisibilité : le QR doit garder un contraste suffisant entre modules et fond (>= 4:1 conseillé). */
export function qrContrastOk(fg: string, bg: string): boolean {
  const lum = (h: string) => { const n = h.replace('#', ''); const [r, g, b] = [0, 2, 4].map((i) => { const c = parseInt(n.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! }
  const [a, b] = [lum(fg), lum(bg)]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4 && lum(fg) < lum(bg)
}
