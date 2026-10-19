import { eq } from 'drizzle-orm'
import { defineEventHandler, getHeader, readRawBody, createError } from 'h3'
import { useDb } from '~~/server/utils/db'
import { paymentWebhookEvents, payments } from '~~/server/db/schema'
import { parseWebhook } from '~~/server/services/fedapay'
import { verifyAndSettle } from '~~/server/services/payments'
import { HttpError } from '~~/server/utils/errors'
import { limit } from '~~/server/utils/api'

// Webhook FedaPay : signature vérifiée (SDK officiel) → déduplication → re-vérification serveur-à-serveur → règlement idempotent.
export default defineEventHandler(async (e) => {
  limit(e, 'webhook', 300, 60_000)
  const raw = (await readRawBody(e, 'utf8')) ?? ''
  let ev
  try { ev = parseWebhook(raw, getHeader(e, 'x-fedapay-signature')) } catch (err) {
    if (err instanceof HttpError) throw createError({ statusCode: err.status, statusMessage: err.message })
    throw err
  }
  const db = useDb()
  const inserted = await db.insert(paymentWebhookEvents).values({ provider: 'fedapay', dedupeKey: ev.dedupeKey, eventName: ev.name, providerTxId: ev.entityId, payload: ev.payload, signatureOk: true }).onConflictDoNothing().returning({ id: paymentWebhookEvents.id })
  let rowId = inserted[0]?.id
  if (!rowId) { // déjà reçu : on ne retraite que s'il avait échoué
    const [ex] = await db.select().from(paymentWebhookEvents).where(eq(paymentWebhookEvents.dedupeKey, ev.dedupeKey)).limit(1)
    if (ex?.processedAt) return { ok: true, duplicate: true }
    rowId = ex!.id
  }
  try {
    if (ev.entityId && ev.name.startsWith('transaction.')) {
      const [pay] = await db.select().from(payments).where(eq(payments.providerTxId, ev.entityId)).limit(1)
      if (pay) await verifyAndSettle(db, pay.orderId) // ne se fie pas au contenu du webhook : relit la transaction chez FedaPay
    }
    await db.update(paymentWebhookEvents).set({ processedAt: new Date(), error: null }).where(eq(paymentWebhookEvents.id, rowId))
    return { ok: true }
  } catch (err) {
    await db.update(paymentWebhookEvents).set({ error: String((err as Error).message).slice(0, 300) }).where(eq(paymentWebhookEvents.id, rowId))
    throw createError({ statusCode: 500, statusMessage: 'Traitement différé' }) // FedaPay réessaiera
  }
})
