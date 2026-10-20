import { z } from 'zod'
import { api, clientIp, parseBody } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { setPlatformFeatures } from '~~/server/services/settings'
import { DEFAULT_PLATFORM_FEATURES } from '~~/shared/platform-features'

const schema = z.object({
  eventCreation: z.boolean(),
  onlineSales: z.boolean(),
  physicalSales: z.boolean(),
  ticketTransfers: z.boolean(),
  offlineScanning: z.boolean(),
  inAppNotifications: z.boolean()
}).strict()

export default api(async (e) => {
  const admin = await requirePlatformAdmin(e)
  const value = await parseBody(e, schema)
  const features = { ...DEFAULT_PLATFORM_FEATURES, ...value }
  await setPlatformFeatures(useDb(), admin.id, features, clientIp(e))
  return { features }
})
