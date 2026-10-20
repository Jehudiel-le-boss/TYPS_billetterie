import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { getPlatformFeatures } from '~~/server/services/settings'

export default api(() => getPlatformFeatures(useDb()))
