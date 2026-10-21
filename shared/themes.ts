// 16 thèmes TYPS. Chaque thème pilote des variables CSS (--c-*) appliquées au site et/ou au billet.
export interface Theme {
  id: string; name: string; blurb: string; mode: 'dark' | 'light'
  bg: string; surface: string; fg: string; muted: string; a: string; b: string; line: string
  radius: number; font: 'display' | 'sans' | 'serif' | 'mono'
}
const T = (id: string, name: string, blurb: string, mode: Theme['mode'], bg: string, surface: string, fg: string, muted: string, a: string, b: string, line: string, radius = 18, font: Theme['font'] = 'sans'): Theme =>
  ({ id, name, blurb, mode, bg, surface, fg, muted, a, b, line, radius, font })

export const THEMES: Theme[] = [
  T('obsidian', 'Obsidienne', 'Noir, argent et reflets métalliques', 'dark', '#090a0e', '#14161d', '#eceef2', '#9aa1ae', '#c8cfdb', '#6b7486', '#2a2e3a'),
  T('neon-cyber', 'Neon Cyber', 'Violet électrique, cyan et particules', 'dark', '#0a0618', '#150e2e', '#f1eaff', '#a79bc9', '#22d3ee', '#a855f7', '#2e2354', 14),
  T('royal-gold', 'Royal Gold', 'Noir et or luxueux', 'dark', '#0c0a06', '#17130a', '#f6ecd2', '#b3a47c', '#d4af37', '#8a6d1d', '#33290f', 10, 'serif'),
  T('crimson-night', 'Crimson Night', 'Rouge profond et noir', 'dark', '#12060a', '#220c13', '#fbe9ec', '#c79aa3', '#f43f5e', '#9f1239', '#43141f'),
  T('aurora', 'Aurora', 'Dégradés boréaux', 'dark', '#06131a', '#0d222c', '#e6fff7', '#8fb8b0', '#34d399', '#60a5fa', '#1c3d49', 22),
  T('tropical', 'Tropical', 'Couleurs tropicales, énergie festive', 'dark', '#052b2b', '#0a3d3b', '#fff7e0', '#a9cbbd', '#fb923c', '#14b8a6', '#0f5551', 26),
  T('afro-vibes', 'Afro Vibes', 'Palette contemporaine : terre, safran, indigo', 'dark', '#1a0f06', '#2a1a0c', '#fff1dc', '#c9ab88', '#f59e0b', '#c2410c', '#4a2f17', 8, 'display'),
  T('festival', 'Festival', 'Couleurs vives, compositions dynamiques', 'dark', '#1b0a2e', '#2a1245', '#ffffff', '#cdb6e6', '#f43f5e', '#facc15', '#47216f', 28, 'display'),
  T('minimal-white', 'Minimal White', 'Blanc, gris, typographie épurée', 'light', '#fafafa', '#ffffff', '#111111', '#5b5f68', '#111111', '#9ca3af', '#e4e4e7', 12),
  T('luxury-ivory', 'Luxury Ivory', 'Ivoire et champagne', 'light', '#f7f1e3', '#fffaf0', '#2b2417', '#6f6247', '#7a5c2e', '#c9b27c', '#e4d8bd', 6, 'serif'),
  T('ocean-blue', 'Ocean Blue', 'Bleu profond et cyan', 'dark', '#031a33', '#082a4d', '#e6f6ff', '#8fb4d1', '#06b6d4', '#2563eb', '#12406e', 20),
  T('sunset', 'Sunset', 'Orange, corail et rose', 'dark', '#2a0e12', '#41161d', '#fff0ea', '#d9a89a', '#fb7185', '#fb923c', '#5e2229', 24),
  T('retro-wave', 'Retro Wave', 'Rétro-futurisme néon', 'dark', '#150a2b', '#22123f', '#ffe9ff', '#c9a6d6', '#ff4fd8', '#4f9dff', '#3a1d66', 4, 'mono'),
  T('gothic-velvet', 'Gothic Velvet', 'Bordeaux, violet, velours', 'dark', '#1a0712', '#2b0f1f', '#f5e6f0', '#bf98b0', '#d946ef', '#9f1239', '#4a1936', 6, 'serif'),
  T('corporate-pro', 'Corporate Pro', 'Sobre et professionnel', 'light', '#f1f4f8', '#ffffff', '#0f1b2d', '#566277', '#1d4ed8', '#64748b', '#d9e0ea', 10),
  T('street-culture', 'Street Culture', 'Urbain, typographie audacieuse', 'dark', '#111111', '#1c1c1c', '#f5f5f0', '#a3a39b', '#ffe600', '#ff3b00', '#333333', 0, 'display')
]
export const DEFAULT_THEME_ID = 'neon-cyber'
export const themeById = (id?: string | null): Theme => THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!
export const eventTheme = (id?: string | null, custom?: Theme | null): Theme =>
  custom && custom.id === id && id?.startsWith('custom-') ? custom : themeById(id)

const triplet = (hex: string) => {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return `${parseInt(n.slice(0, 2), 16)} ${parseInt(n.slice(2, 4), 16)} ${parseInt(n.slice(4, 6), 16)}`
}
export const FONT_STACKS: Record<Theme['font'], string> = {
  display: "'Unbounded', 'Figtree', system-ui, sans-serif",
  sans: "'Figtree', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SFMono-Regular', Menlo, monospace"
}
export function themeVars(t: Theme): Record<string, string> {
  return {
    '--c-bg': triplet(t.bg), '--c-surface': triplet(t.surface), '--c-fg': triplet(t.fg), '--c-muted': triplet(t.muted),
    '--c-a': triplet(t.a), '--c-b': triplet(t.b), '--c-line': triplet(t.line),
    '--radius': `${t.radius}px`, '--font-theme': FONT_STACKS[t.font], 'color-scheme': t.mode
  }
}
/** Contraste WCAG (ratio) — utilisé pour choisir le texte lisible sur l'accent. */
export function luminance(hex: string) {
  const [r, g, b] = triplet(hex).split(' ').map((x) => { const c = Number(x) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05) }
export const onAccent = (t: Theme) => (contrast(t.a, t.bg) >= contrast(t.a, '#ffffff') ? t.bg : '#ffffff')
