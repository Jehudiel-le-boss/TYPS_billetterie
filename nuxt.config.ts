// TYPS — configuration Nuxt 3 (Nitro, SSR). Les secrets sont lus à l'exécution via server/utils/env.ts.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', 'motion-v/nuxt'],
  css: ['~/assets/css/main.css'],
  typescript: { strict: true, typeCheck: false },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      titleTemplate: '%s · TYPS',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#090a0e' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Unbounded:wght@500;700;900&display=swap' }
      ]
    }
  },
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://typs-ashy.vercel.app',
      appName: 'TYPS'
    }
  },
  routeRules: {
    '/app/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/admin/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/scan/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/orders/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/api/**': { headers: { 'Cache-Control': 'no-store' } }
  },
  nitro: { compressPublicAssets: true },
  vite: { build: { chunkSizeWarningLimit: 1200 } }
})
