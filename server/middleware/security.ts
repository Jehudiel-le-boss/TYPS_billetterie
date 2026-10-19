import { defineEventHandler, getHeader, getRequestURL, setHeader, createError } from 'h3'
// En-têtes de sécurité + protection CSRF : les requêtes mutantes vers /api doivent provenir de la même origine (cookies SameSite=Lax en plus).
export default defineEventHandler((e) => {
  setHeader(e, 'X-Content-Type-Options', 'nosniff'); setHeader(e, 'X-Frame-Options', 'SAMEORIGIN'); setHeader(e, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(e, 'Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)')
  if (process.env.NODE_ENV === 'production') setHeader(e, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  const url = getRequestURL(e)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.method) && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/webhooks/') && !url.pathname.startsWith('/api/internal/')) {
    const origin = getHeader(e, 'origin')
    if (origin && new URL(origin).host !== (getHeader(e, 'x-forwarded-host') ?? getHeader(e, 'host'))) throw createError({ statusCode: 403, statusMessage: 'Origine refusée' })
    if (!origin && getHeader(e, 'sec-fetch-site') === 'cross-site') throw createError({ statusCode: 403, statusMessage: 'Origine refusée' })
  }
})
