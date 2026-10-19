import { getHeader } from 'h3'
import { api, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { HttpError, fail } from '~~/server/utils/errors'
import { establishNeonSession } from '~~/server/services/neon-auth'

export default api(async (e) => {
  limit(e, 'neon-session', 20, 600_000)
  const authorization = getHeader(e, 'authorization') ?? ''
  const match = /^Bearer ([^\s]+)$/.exec(authorization)
  if (!match) fail(401, 'Jeton Neon requis', 'unauthenticated')
  const token = match?.[1]
  if (!token) throw new HttpError(401, 'Jeton Neon requis', 'unauthenticated')
  await establishNeonSession(e, useDb(), token)
  return { ok: true }
})
