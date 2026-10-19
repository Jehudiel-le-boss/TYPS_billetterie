import { sql } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { useDb } from '../utils/db'
import { env } from '../utils/env'
// Sonde de santé (aucun secret) : base joignable, mode d'exécution, état de la configuration externe.
export default defineEventHandler(async () => {
  let db = false
  try { await useDb().execute(sql`select 1`); db = true } catch { db = false }
  const f = env.fedapay(), s3 = env.s3()
  return { ok: db, db, production: env.isProd(), demoMode: env.demoMode(), fedapay: { mode: f.mode, configured: !!f.secretKey, webhookSecret: !!f.webhookSecret }, storage: s3.bucket ? 's3' : 'local-dev', mail: !!env.mail().apiKey }
})
