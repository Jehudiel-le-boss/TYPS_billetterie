import { formatMoney } from '~~/shared/money'
import { THEMES, DEFAULT_THEME_ID, themeById, themeVars, onAccent, type Theme } from '~~/shared/themes'
export const cssVars = (t: Theme) => ({ ...themeVars(t), '--on-accent': onAccent(t) })
export function useTheme() {
  const id = useCookie<string>('typs_theme', { default: () => DEFAULT_THEME_ID, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  const custom = useState<Theme[]>('custom-themes', () => [])
  if (import.meta.client && !custom.value.length) { try { custom.value = JSON.parse(localStorage.getItem('typs_custom_themes') || '[]') } catch { /* ignore */ } }
  const all = computed(() => [...THEMES, ...custom.value])
  const find = (tid?: string | null): Theme => all.value.find((t) => t.id === tid) ?? themeById(tid)
  const current = computed(() => find(id.value))
  const saveCustom = (t: Theme) => { custom.value = [...custom.value.filter((c) => c.id !== t.id), t]; if (import.meta.client) localStorage.setItem('typs_custom_themes', JSON.stringify(custom.value)); id.value = t.id }
  const removeCustom = (tid: string) => {
    if (!custom.value.some((t) => t.id === tid)) return false
    custom.value = custom.value.filter((t) => t.id !== tid)
    if (import.meta.client) localStorage.setItem('typs_custom_themes', JSON.stringify(custom.value))
    if (id.value === tid) id.value = DEFAULT_THEME_ID
    return true
  }
  return { id, current, all, custom, find, set: (tid: string) => { id.value = tid }, saveCustom, removeCustom, vars: (t?: Theme) => cssVars(t ?? current.value) }
}
export const toStyle = (v: Record<string, string>) => Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
export function useGlobalTheme() {
  const { current } = useTheme()
  useHead(() => ({ htmlAttrs: { style: toStyle(cssVars(current.value)) }, meta: [{ name: 'theme-color', content: current.value.bg }] }))
}
export const useReducedMotion = () => { const r = ref(false); onMounted(() => { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); r.value = m.matches; m.addEventListener('change', (e) => { r.value = e.matches }) }); return r }
export const money = (n: number, cur = 'XOF') => formatMoney(n, cur)
export const fdate = (d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: 'full', timeStyle: 'short' }) => d ? new Intl.DateTimeFormat('fr-FR', opts).format(new Date(d)) : ''
