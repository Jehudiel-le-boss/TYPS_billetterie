import type { Config } from 'tailwindcss'
const v = (n: string) => `rgb(var(--c-${n}) / <alpha-value>)`
export default {
  content: ['./components/**/*.vue', './layouts/**/*.vue', './pages/**/*.vue', './app.vue', './composables/**/*.ts', './shared/**/*.ts'],
  theme: {
    extend: {
      colors: { bg: v('bg'), surface: v('surface'), fg: v('fg'), muted: v('muted'), accent: v('a'), accent2: v('b'), line: v('line') },
      fontFamily: {
        display: ['Unbounded', 'Figtree', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif']
      },
      borderRadius: { tk: 'var(--radius)' },
      boxShadow: { glow: '0 0 60px -12px rgb(var(--c-a) / .55)', deep: '0 30px 80px -20px rgb(0 0 0 / .6)' }
    }
  }
} satisfies Config
