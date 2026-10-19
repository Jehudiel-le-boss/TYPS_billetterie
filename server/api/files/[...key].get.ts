import { getQuery, getRouterParam, setHeader } from 'h3'
import { api } from '~~/server/utils/api'
import { readLocal, verifyLocalSignature } from '~~/server/services/storage'
import { fail } from '~~/server/utils/errors'
// Service local de fichiers signés (développement). En production S3 : URLs présignées directement.
export default api(async (e) => {
  const key = decodeURIComponent(String(getRouterParam(e, 'key') ?? ''))
  const q = getQuery(e)
  if (!key || !verifyLocalSignature(key, Number(q.exp), String(q.sig ?? ''))) return fail(403, 'Lien expiré ou invalide', 'bad_signature')
  setHeader(e, 'Content-Type', key.endsWith('.png') ? 'image/png' : 'image/jpeg'); setHeader(e, 'X-Content-Type-Options', 'nosniff'); setHeader(e, 'Cache-Control', 'private, max-age=600')
  try { return await readLocal(key) } catch { return fail(404, 'Fichier introuvable', 'not_found') }
})
