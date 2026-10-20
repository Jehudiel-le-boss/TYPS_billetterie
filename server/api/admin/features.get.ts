import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { getPlatformFeatures } from '~~/server/services/settings'
import { PLATFORM_FEATURES } from '~~/shared/platform-features'

export default api(async (e) => {
  await requirePlatformAdmin(e)
  return { features: await getPlatformFeatures(useDb()), metadata: PLATFORM_FEATURES }
})
