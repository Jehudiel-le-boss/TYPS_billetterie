import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { getFeeConfig } from '~~/server/services/settings'
export default api(async (e) => { await requirePlatformAdmin(e); return getFeeConfig(useDb()) })
