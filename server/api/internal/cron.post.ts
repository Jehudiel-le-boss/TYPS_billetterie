import { getHeader } from 'h3'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { env } from '~~/server/utils/env'
import { safeEqual } from '~~/server/utils/crypto'
import { fail } from '~~/server/utils/errors'
import { expireHolds } from '~~/server/services/checkout'
import { verifyAndSettle } from '~~/server/services/payments'
import { processDueJobs } from '~~/server/services/mail'
import { releaseWaitlist } from '~~/server/services/waitlist'
// À appeler toutes les 5 min (cron de l'hébergeur) avec l'en-tête x-cron-secret.
export default api(async (e) => {
  const secret = env.cronSecret(), got = getHeader(e, 'x-cron-secret') ?? ''
  if (!secret || !safeEqual(secret, got)) return fail(401, 'Non autorisé', 'unauthorized')
  const db = useDb()
  const expired = await expireHolds(db, new Date(), async (id) => (await verifyAndSettle(db, id)).state === 'paid')
  return { expired, reminders: await processDueJobs(db), waitlistNotified: await releaseWaitlist(db) }
})
