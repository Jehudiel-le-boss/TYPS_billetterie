import { getQuery, getRouterParam, setHeader } from 'h3'
import { api } from '~~/server/utils/api'
import { getObject, verifyLocalSignature } from '~~/server/services/storage'
import { fail } from '~~/server/utils/errors'
// Sert les fichiers locaux ou Cloudinary via URL HMAC temporaire.
export default api(async (e) => {
  const key = decodeURIComponent(String(getRouterParam(e, 'key') ?? ''))
  const q = getQuery(e)
  if (!key || !verifyLocalSignature(key, Number(q.exp), String(q.sig ?? ''))) return fail(403, 'Lien expiré ou invalide', 'bad_signature')
  const contentType = key.endsWith('.png') ? 'image/png' : 'image/jpeg'
  setHeader(e, 'Content-Type', contentType); setHeader(e, 'X-Content-Type-Options', 'nosniff'); setHeader(e, 'Cache-Control', 'private, max-age=600')
  try { return await getObject(key) } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return fail(404, 'Fichier introuvable', 'not_found')
    throw error
  }
})
