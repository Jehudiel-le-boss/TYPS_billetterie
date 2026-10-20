import { eq } from 'drizzle-orm'
import { api, parseBody, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { checkoutSchema } from '~~/shared/validation'
import { getFeeConfig } from '~~/server/services/settings'
import { createOnlineOrder, expireHolds } from '~~/server/services/checkout'
import { createPayment } from '~~/server/services/fedapay'
import { events, orders, payments } from '~~/server/db/schema'
import { env } from '~~/server/utils/env'
import { fail } from '~~/server/utils/errors'
import { requirePlatformFeature } from '~~/server/utils/feature-gates'

export default api(async (e) => {
  limit(e, 'checkout', 20, 600_000)
  const b = await parseBody(e, checkoutSchema)
  const db = useDb()
  await requirePlatformFeature(e, 'onlineSales')
  const [ev] = await db.select({ isDemo: events.isDemo, title: events.title }).from(events).where(eq(events.id, b.eventId)).limit(1)
  if (!ev) return fail(404, 'Événement introuvable', 'not_found')
  const demo = ev.isDemo && env.demoMode()
  if (ev.isDemo && !demo) return fail(403, 'Événement de démonstration indisponible hors mode démo', 'demo_disabled')
  const created = await createOnlineOrder(db, { ...b, demo }, await getFeeConfig(db))
  const kq = `k=${created.accessToken}`
  const done = `/orders/${created.orderId}/confirmation?${kq}`
  if (created.free || demo) return { orderId: created.orderId, k: created.accessToken, redirect: demo && !created.free ? `/orders/${created.orderId}/demo-pay?${kq}` : done }
  try {
    const p = await createPayment({ amount: created.total, currency: created.currency, description: `${ev.title} — ${created.paymentReference}`, callbackUrl: `${env.siteUrl()}${done}`, customer: b.buyer, merchantReference: created.paymentReference, orderId: created.orderId })
    await db.update(payments).set({ providerTxId: p.txId, status: 'pending', updatedAt: new Date() }).where(eq(payments.orderId, created.orderId))
    return { orderId: created.orderId, k: created.accessToken, redirect: p.url, external: true }
  } catch (err) {
    await db.update(orders).set({ expiresAt: new Date(0) }).where(eq(orders.id, created.orderId)); await expireHolds(db) // rend les places immédiatement
    throw err
  }
})
