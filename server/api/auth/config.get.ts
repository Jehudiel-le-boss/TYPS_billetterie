import { api } from '~~/server/utils/api'
import { fail } from '~~/server/utils/errors'
import { env } from '~~/server/utils/env'

export default api(() => {
  const baseUrl = env.neonAuthBaseUrl()
  if (!baseUrl) fail(503, 'Neon Auth n’est pas configuré', 'neon_auth_not_configured')
  return { baseUrl }
})
