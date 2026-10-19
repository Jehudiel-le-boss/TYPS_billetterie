import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrderAccess } from '~~/server/utils/orders'
import { settleOrderPaid } from '~~/server/services/checkout'
import { env } from '~~/server/utils/env'
import { fail } from '~~/server/utils/errors'
// Paiement SIMULÉ : uniquement pour les événements de démonstration, jamais en production, jamais via FedaPay.
export default api(async (e) => {
  const id = uuidParam(e, 'id')
  const { order } = await requireOrderAccess(e, id)
  if (!env.demoMode() || !order.isDemo) return fail(403, 'Mode démonstration désactivé', 'demo_disabled')
  const out = await settleOrderPaid(useDb(), id, { provider: 'demo', amount: order.total, currency: order.currency, raw: { demo: true } })
  return { outcome: out }
})
