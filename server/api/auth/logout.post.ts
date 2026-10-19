import { api } from '~~/server/utils/api'
import { endSession } from '~~/server/utils/session'
export default api(async (e) => { await endSession(e); return { ok: true } })
