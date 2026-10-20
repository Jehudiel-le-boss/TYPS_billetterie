import { sql } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { useDb } from '../utils/db'
import { env } from '../utils/env'
// Sonde de santé (aucun secret) : base joignable, mode d'exécution, état de la configuration externe.
export default defineEventHandler(async () => {
  let db = false
  try { await useDb().execute(sql`select 1`); db = true } catch { db = false }
  const f = env.fedapay(), s3 = env.s3(), cloudinary = env.cloudinary()
  const mail = !!env.mail().apiKey
  let neonAuth = false
  let neonAuthStatus = 'not_configured'
  const neonAuthBaseUrl = env.neonAuthBaseUrl()
  if (neonAuthBaseUrl) {
    try {
      const result = await useDb().execute(sql`select to_regclass('neon_auth."user"') as auth_user`)
      if (!result.rows[0]?.auth_user) {
        neonAuthStatus = 'schema_unavailable'
      } else {
        await useDb().execute(sql`select id from neon_auth."user" limit 0`)
        const response = await fetch(`${neonAuthBaseUrl}/.well-known/jwks.json`, { signal: AbortSignal.timeout(3000) })
        if (!response.ok) {
          neonAuthStatus = 'service_unavailable'
        } else {
          const jwks: unknown = await response.json()
          neonAuth = !!jwks && typeof jwks === 'object' && 'keys' in jwks && Array.isArray(jwks.keys) && jwks.keys.length > 0
          neonAuthStatus = neonAuth ? 'ready' : 'jwks_unavailable'
        }
      }
    } catch { neonAuthStatus = 'service_unavailable' }
  }
  const cloudinaryConfigured = !!(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret)
  const cloudinaryPartial = !!(cloudinary.cloudName || cloudinary.apiKey || cloudinary.apiSecret) && !cloudinaryConfigured
  const s3Configured = !!(s3.bucket && s3.accessKeyId && s3.secretAccessKey)
  const storage = cloudinaryConfigured || (!cloudinaryPartial && s3Configured)
  const storageProvider = cloudinaryConfigured ? 'cloudinary' : s3Configured ? 's3' : cloudinaryPartial ? 'misconfigured' : 'local-dev'
  const https = env.siteUrl().startsWith('https://')
  const secrets = ['SESSION_SECRET', 'QR_SECRET', 'CRON_SECRET'].every((name) => (process.env[name]?.length ?? 0) >= 16)
  const production = env.isProd()
  const checks = { db, secrets, cron: !!env.cronSecret(), https, fedapay: !!f.secretKey, webhook: !!f.webhookSecret, storage, mail, neonAuth }
  const blockers = production ? Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name) : []
  return { ok: db, ready: db && blockers.length === 0, production, authProvider: neonAuthBaseUrl ? 'neon-managed' : 'unconfigured', neonAuthStatus, demoMode: env.demoMode(), fedapay: { mode: f.mode, configured: !!f.secretKey, webhookSecret: !!f.webhookSecret }, storage: storageProvider, mail, checks, blockers }
})
