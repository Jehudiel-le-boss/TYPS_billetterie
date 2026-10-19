// Lecture paresseuse des variables d'environnement (valeurs lues à l'exécution, jamais figées au build).
// NODE_ENV est figé à « production » au build Nitro. APP_ENV (runtime) permet un environnement de recette/démo (staging, development) ; par défaut : production.
const isProd = () => (process.env.APP_ENV ? process.env.APP_ENV === 'production' : process.env.NODE_ENV === 'production')
function secret(name: string, devFallback: string): string {
  const v = process.env[name]
  if (v && v.length >= 16) return v
  if (isProd()) throw new Error(`Variable d'environnement ${name} manquante ou trop courte (16+ caractères) en production`)
  return devFallback
}
export const env = {
  isProd,
  databaseUrl: () => { const v = process.env.DATABASE_URL; if (!v) throw new Error('DATABASE_URL manquante (chaîne Neon)'); return v },
  sessionSecret: () => secret('SESSION_SECRET', 'dev-only-session-secret-change-me'),
  qrSecret: () => secret('QR_SECRET', 'dev-only-qr-secret-change-me-too'),
  cronSecret: () => process.env.CRON_SECRET || '',
  siteUrl: () => (process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  /** Le mode démonstration est TOUJOURS désactivé en production. */
  demoMode: () => !isProd() && process.env.DEMO_MODE === 'true',
  fedapay: () => {
    const live = process.env.FEDAPAY_ENV === 'live'
    return {
      mode: (live ? 'live' : 'sandbox') as 'live' | 'sandbox',
      secretKey: (live ? process.env.FEDAPAY_SECRET_KEY_LIVE : process.env.FEDAPAY_SECRET_KEY_SANDBOX) || '',
      webhookSecret: (live ? process.env.FEDAPAY_WEBHOOK_SECRET_LIVE : process.env.FEDAPAY_WEBHOOK_SECRET_SANDBOX) || ''
    }
  },
  s3: () => ({ endpoint: process.env.S3_ENDPOINT || '', region: process.env.S3_REGION || 'auto', bucket: process.env.S3_BUCKET || '', accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' }),
  mail: () => ({ apiKey: process.env.RESEND_API_KEY || '', from: process.env.MAIL_FROM || 'TYPS <billets@localhost>' })
}
