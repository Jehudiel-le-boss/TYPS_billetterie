import { api, parseBody, clientIp } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { setFeeConfig } from '~~/server/services/settings'
import { feeSettingsSchema } from '~~/shared/validation'
// Les frais sont une configuration traçable (audit_logs : avant / après). Aucun tarif par défaut inventé : tout démarre à 0.
export default api(async (e) => { const a = await requirePlatformAdmin(e); const v = await parseBody(e, feeSettingsSchema); await setFeeConfig(useDb(), a.id, v, clientIp(e)); return v })
