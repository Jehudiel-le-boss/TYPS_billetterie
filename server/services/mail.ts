import { eq } from 'drizzle-orm'
import { notificationJobs, notificationLogs } from '../db/schema'
import type { Db } from '../utils/db'
import { env } from '../utils/env'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export const mailLayout = (title: string, body: string, cta?: { label: string; url: string }) =>
  `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#0b0c12;color:#eceef2;border-radius:16px"><h1 style="font-size:22px;margin:0 0 12px">${esc(title)}</h1><p style="line-height:1.6;color:#c9ceda">${body}</p>${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#22d3ee;color:#04121a;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">${esc(cta.label)}</a></p>` : ''}<p style="font-size:12px;color:#8a90a0">TYPS — Ton événement. Ton ticket. Ton contrôle.</p></div>`

/** Envoi immédiat. Aucun jeton secret n'est persisté : seul le résultat est journalisé (notification_logs). */
export async function sendEmail(db: Db, to: string, subject: string, html: string): Promise<boolean> {
  const m = env.mail()
  let status = 'skipped', response = 'RESEND_API_KEY absent : e-mail non envoyé (journalisé uniquement)'
  if (m.apiKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${m.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: m.from, to: [to], subject, html }) })
      status = r.ok ? 'sent' : 'failed'; response = `HTTP ${r.status}`
    } catch (err) { status = 'failed'; response = String((err as Error).message).slice(0, 200) }
  }
  await db.insert(notificationLogs).values({ channel: 'email', status, response: `${subject} → ${to.replace(/(.).+(@.+)/, '$1***$2')} : ${response}` })
  return status === 'sent'
}
export type EmailDeliveryStatus = 'sent' | 'not_configured' | 'rejected' | 'error'
export interface EmailDelivery { status: EmailDeliveryStatus; httpStatus?: number; reason?: string }
const safeEmailReason = (value: string) => value
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[adresse masquée]')
  .replace(/\b(?:re|rk)_[A-Za-z0-9_-]{12,}\b/g, '[clé masquée]')
  .replace(/\s+/g, ' ')
  .slice(0, 240)

export async function sendEmailWithStatus(db: Db, to: string, subject: string, html: string): Promise<EmailDelivery> {
  const m = env.mail()
  let delivery: EmailDelivery
  let logStatus: string
  let detail: string
  if (!m.apiKey) {
    delivery = { status: 'not_configured', reason: 'RESEND_API_KEY absente dans cet environnement.' }
    logStatus = 'skipped'
    detail = delivery.reason ?? 'RESEND_API_KEY absente dans cet environnement.'
  } else {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${m.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: m.from, to: [to], subject, html })
      })
      if (response.ok) {
        delivery = { status: 'sent', httpStatus: response.status }
        logStatus = 'sent'
        detail = `HTTP ${response.status}`
      } else {
        const payload: unknown = await response.json().catch(() => null)
        const errorBody = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
        const providerName = typeof errorBody.name === 'string' ? safeEmailReason(errorBody.name) : ''
        const providerMessage = typeof errorBody.message === 'string' ? safeEmailReason(errorBody.message) : ''
        const reason = [providerName, providerMessage].filter(Boolean).join(' : ')
        delivery = {
          status: response.status >= 500 ? 'error' : 'rejected',
          httpStatus: response.status,
          ...(reason && { reason })
        }
        logStatus = 'failed'
        detail = `HTTP ${response.status}${reason ? ` : ${reason}` : ''}`
      }
    } catch (error) {
      const reason = safeEmailReason(error instanceof Error ? error.message : 'Erreur réseau inconnue')
      delivery = { status: 'error', reason: 'Impossible de joindre le service e-mail.' }
      logStatus = 'failed'
      detail = `Erreur réseau : ${reason}`
    }
  }
  const maskedTo = to.replace(/(.).+(@.+)/, '$1***$2')
  await db.insert(notificationLogs).values({
    channel: 'email',
    status: logStatus,
    response: `${subject} → ${maskedTo} : ${detail}`
  })
  return delivery
}
/** Rappels planifiés (sans secret dans la charge utile). Traités par scripts/… ou /api/internal/cron. */
export async function scheduleReminder(db: Db, toEmail: string, payload: { eventId: string; slug: string; title: string }, runAt: Date) {
  await db.insert(notificationJobs).values({ kind: 'event_reminder', toEmail, payload, runAt })
}
export async function processDueJobs(db: Db, now = new Date(), limit = 50): Promise<number> {
  if (!env.mail().apiKey) return 0
  const { lte, and } = await import('drizzle-orm')
  const jobs = await db.select().from(notificationJobs).where(and(eq(notificationJobs.status, 'queued'), lte(notificationJobs.runAt, now))).limit(limit)
  for (const j of jobs) {
    const p = j.payload as { slug: string; title: string }
    const ok = await sendEmail(db, j.toEmail, `Rappel : ${p.title}`, mailLayout(`${p.title} approche`, 'Votre billet est prêt dans votre boîte e-mail. Pensez à le présenter à l’entrée.', { label: 'Voir l’événement', url: `${env.siteUrl()}/events/${p.slug}` }))
    const attempts = j.attempts + 1
    await db.update(notificationJobs).set({
      status: ok ? 'sent' : attempts >= 5 ? 'failed' : 'queued',
      attempts,
      runAt: ok ? j.runAt : new Date(now.getTime() + Math.min(2 ** attempts * 60_000, 3_600_000))
    }).where(eq(notificationJobs.id, j.id))
  }
  return jobs.length
}
