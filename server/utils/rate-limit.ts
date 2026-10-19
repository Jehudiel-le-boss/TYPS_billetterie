// Limiteur à fenêtre glissante, en mémoire (par instance). En multi-instances, remplacer par Redis/Upstash (voir SECURITY.md).
const hits = new Map<string, number[]>()
export function rateLimitCheck(key: string, max: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= max) { hits.set(key, list); return { ok: false, retryAfter: Math.ceil((windowMs - (now - list[0]!)) / 1000) } }
  list.push(now); hits.set(key, list)
  if (hits.size > 20000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1]! > windowMs) hits.delete(k)
  return { ok: true, retryAfter: 0 }
}
export const _resetRateLimit = () => hits.clear()
