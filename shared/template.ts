// Modèle de billet : un JSON unique, rendu à l'identique par l'éditeur (HTML), l'aperçu et le moteur PDF (pdf-lib).
export const FIELD_KEYS = ['event_title', 'holder_name', 'category', 'price', 'currency', 'ticket_number', 'datetime', 'venue', 'order_id', 'vip_badge', 'access_terms', 'organizer_logo'] as const
export type FieldKey = (typeof FIELD_KEYS)[number]
export const FIELD_LABELS: Record<FieldKey, string> = {
  event_title: "Nom de l'événement", holder_name: 'Nom du participant', category: 'Catégorie', price: 'Prix payé', currency: 'Devise',
  ticket_number: 'Numéro de billet', datetime: 'Date et heure', venue: 'Lieu', order_id: 'Identifiant de commande', vip_badge: 'Mention VIP',
  access_terms: "Conditions d'accès", organizer_logo: "Logo de l'organisateur"
}
export const PDF_FONTS = ['sans', 'serif', 'mono'] as const
export type PdfFont = (typeof PDF_FONTS)[number]
export const CSS_FONT: Record<PdfFont, string> = { sans: 'Helvetica, Arial, sans-serif', serif: "'Times New Roman', Times, serif", mono: "'Courier New', Courier, monospace" }

export interface BaseEl { id: string; x: number; y: number; w: number; h: number; opacity: number; hidden?: boolean; name?: string }
export interface TextStyle { fontSize: number; font: PdfFont; bold: boolean; color: string; align: 'left' | 'center' | 'right' }
export type TplElement =
  | (BaseEl & { type: 'field'; field: Exclude<FieldKey, 'organizer_logo'> } & TextStyle & { prefix?: string })
  | (BaseEl & { type: 'text'; text: string } & TextStyle)
  | (BaseEl & { type: 'qr'; fg: string; bg: string; quiet: boolean })
  | (BaseEl & { type: 'image'; assetId: string; fit: 'contain' | 'cover'; field?: 'organizer_logo' })
  | (BaseEl & { type: 'shape'; shape: 'rect' | 'ellipse'; fill: string; stroke: string; strokeWidth: number; radius: number })

export interface TemplateLayout {
  v: 1; width: number; height: number
  background: { color: string; assetId?: string | null }
  elements: TplElement[]
}
export const PRINT_FORMATS = [
  { id: 'digital', label: 'Numérique 900×360', width: 900, height: 360 },
  { id: 'a6', label: 'A6 paysage (148×105 mm)', width: 559, height: 397 },
  { id: 'dl', label: 'Billet DL (210×99 mm)', width: 794, height: 374 },
  { id: 'mobile', label: 'Mobile portrait 360×640', width: 360, height: 640 }
] as const
export const PX_TO_PT = 0.75

export interface TicketContext {
  eventTitle: string; holderName: string; category: string; price: string; currency: string; ticketNumber: string
  datetime: string; venue: string; orderId: string; vip: boolean; accessTerms: string; demo?: boolean
}
export function resolveField(field: FieldKey, c: TicketContext): string {
  switch (field) {
    case 'event_title': return c.eventTitle
    case 'holder_name': return c.holderName
    case 'category': return c.category
    case 'price': return c.price
    case 'currency': return c.currency
    case 'ticket_number': return c.ticketNumber
    case 'datetime': return c.datetime
    case 'venue': return c.venue
    case 'order_id': return c.orderId
    case 'vip_badge': return c.vip ? 'VIP' : ''
    case 'access_terms': return c.accessTerms
    default: return ''
  }
}
export const SAMPLE_CONTEXT: TicketContext = {
  eventTitle: 'Lagune Live Festival', holderName: 'Aïcha Dossou', category: 'VIP', price: '15 000', currency: 'FCFA', ticketNumber: 'TY-7K3M9QXA',
  datetime: '12 déc. 2026 · 20:00', venue: 'Plage de démonstration, Cotonou', orderId: 'CMD-4F2A91', vip: true, accessTerms: 'Pièce d’identité requise. Billet strictement personnel.', demo: true
}
let n = 0
export const uid = () => `el_${Date.now().toString(36)}_${(n++).toString(36)}`
const txt = { fontSize: 20, font: 'sans' as PdfFont, bold: false, color: '#ffffff', align: 'left' as const }
export function defaultLayout(): TemplateLayout {
  return {
    v: 1, width: 900, height: 360, background: { color: '#12131c', assetId: null },
    elements: [
      { id: uid(), type: 'shape', shape: 'rect', x: 0, y: 0, w: 14, h: 360, opacity: 1, fill: '#22d3ee', stroke: '#000000', strokeWidth: 0, radius: 0, name: 'Bande' },
      { id: uid(), type: 'field', field: 'event_title', x: 48, y: 44, w: 560, h: 56, opacity: 1, ...txt, fontSize: 38, bold: true },
      { id: uid(), type: 'field', field: 'holder_name', x: 48, y: 130, w: 520, h: 34, opacity: 1, ...txt, fontSize: 26 },
      { id: uid(), type: 'field', field: 'datetime', x: 48, y: 190, w: 520, h: 28, opacity: 0.9, ...txt, fontSize: 20 },
      { id: uid(), type: 'field', field: 'venue', x: 48, y: 224, w: 520, h: 28, opacity: 0.9, ...txt, fontSize: 20 },
      { id: uid(), type: 'field', field: 'category', x: 48, y: 290, w: 200, h: 30, opacity: 1, ...txt, fontSize: 22, bold: true, color: '#22d3ee' },
      { id: uid(), type: 'field', field: 'ticket_number', x: 640, y: 300, w: 220, h: 24, opacity: 0.8, ...txt, fontSize: 16, font: 'mono', align: 'center' },
      { id: uid(), type: 'qr', x: 660, y: 70, w: 180, h: 180, opacity: 1, fg: '#000000', bg: '#ffffff', quiet: true }
    ]
  }
}
/** Valide minimalement un layout reçu du client (bornes, types) — le serveur ne fait jamais confiance au JSON entrant. */
export function sanitizeLayout(input: unknown): TemplateLayout {
  const l = input as TemplateLayout
  if (!l || l.v !== 1 || !Array.isArray(l.elements)) throw new Error('Layout invalide')
  const w = Math.min(2400, Math.max(200, Math.round(l.width))), h = Math.min(2400, Math.max(120, Math.round(l.height)))
  if (l.elements.length > 120) throw new Error('Trop d’éléments (120 max)')
  const col = (c: unknown, d: string) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : d)
  const els = l.elements.map((e) => {
    const base = { ...e, id: String(e.id).slice(0, 40), x: Math.round(e.x), y: Math.round(e.y), w: Math.max(4, Math.round(e.w)), h: Math.max(4, Math.round(e.h)), opacity: Math.min(1, Math.max(0, Number(e.opacity ?? 1))) }
    if ('color' in base) (base as any).color = col((base as any).color, '#ffffff')
    if ('text' in base) (base as any).text = String((base as any).text).slice(0, 500)
    if (base.type === 'qr') { (base as any).fg = col((base as any).fg, '#000000'); (base as any).bg = col((base as any).bg, '#ffffff') }
    if (base.type === 'shape') { (base as any).fill = col((base as any).fill, '#ffffff'); (base as any).stroke = col((base as any).stroke, '#000000') }
    return base as TplElement
  })
  return { v: 1, width: w, height: h, background: { color: col(l.background?.color, '#12131c'), assetId: l.background?.assetId ?? null }, elements: els }
}
