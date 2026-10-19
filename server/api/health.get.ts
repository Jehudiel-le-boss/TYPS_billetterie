import { sql } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { useDb } from '../utils/db'
import { env } from '../utils/env'
// Sonde de santé (aucun secret) : base joignable, mode d'exécution, état de la configuration externe.
export default defineEventHandler(async () => {
  let db = false
  try { await useDb().execute(sql`select 1`); db = true } catch { db = false }
  const f = env.fedapay(), s3 = env.s3()
  const mail = !!env.mail().apiKey
  const storage = !!(s3.bucket && s3.accessKeyId && s3.secretAccessKey)
  const https = env.siteUrl().startsWith('https://')
  const secrets = ['SESSION_SECRET', 'QR_SECRET', 'CRON_SECRET'].every((name) => (process.env[name]?.length ?? 0) >= 16)
  const production = env.isProd()
  const checks = { db, secrets, cron: !!env.cronSecret(), https, fedapay: !!f.secretKey, webhook: !!f.webhookSecret, storage, mail, neonAuth: false }
  const blockers = production ? Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name) : []
  return { ok: db, ready: db && blockers.length === 0, production, authProvider: 'custom-session', demoMode: env.demoMode(), fedapay: { mode: f.mode, configured: !!f.secretKey, webhookSecret: !!f.webhookSecret }, storage: storage ? 's3' : 'local-dev', mail, checks, blockers }
})
