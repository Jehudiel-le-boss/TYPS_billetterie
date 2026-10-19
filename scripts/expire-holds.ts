// Libère les réservations expirées (alternative au cron HTTP) : `npm run db:expire-holds`.
import { useDb } from '../server/utils/db'
import { expireHolds } from '../server/services/checkout'
const n = await expireHolds(useDb())
console.log(`${n} réservation(s) expirée(s) libérée(s).`)
process.exit(0)
