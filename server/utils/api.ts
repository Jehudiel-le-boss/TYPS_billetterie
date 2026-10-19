import { createError, defineEventHandler, getRequestIP, getHeader, readBody, getQuery, type H3Event } from 'h3'
import type { ZodType } from 'zod'
import { HttpError } from './errors'
import { rateLimitCheck } from './rate-limit'

export const clientIp = (e: H3Event) => getRequestIP(e, { xForwardedFor: true }) ?? 'unknown'
export function api<T>(fn: (e: H3Event) => Promise<T> | T) {
  return defineEventHandler(async (e) => {
    try { return await fn(e) } catch (err) {
      if (err instanceof HttpError) throw createError({ statusCode: err.status, statusMessage: err.message, data: { code: err.code, ...(err.data as object | undefined) } })
      throw err
    }
  })
}
export async function parseBody<T>(e: H3Event, schema: ZodType<T>): Promise<T> {
  const raw = await readBody(e).catch(() => undefined)
  const r = schema.safeParse(raw)
  if (!r.success) throw new HttpError(422, r.error.issues[0]?.message ? `${r.error.issues[0].path.join('.') || 'donnée'} : ${r.error.issues[0].message}` : 'Données invalides', 'validation', { issues: r.error.issues.slice(0, 8) })
  return r.data
}
export function parseQuery<T>(e: H3Event, schema: ZodType<T>): T {
  const r = schema.safeParse(getQuery(e))
  if (!r.success) throw new HttpError(400, 'Paramètres invalides', 'validation')
  return r.data
}
export function limit(e: H3Event, name: string, max: number, windowMs: number, extra = '') {
  const r = rateLimitCheck(`${name}:${clientIp(e)}:${extra}`, max, windowMs)
  if (!r.ok) throw new HttpError(429, `Trop de tentatives. Réessayez dans ${r.retryAfter}s.`, 'rate_limited')
}
export const originOf = (e: H3Event) => getHeader(e, 'origin')
import { getRouterParam } from 'h3'
export function uuidParam(e: H3Event, name: string): string {
  const v = getRouterParam(e, name)
  if (!v || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw new HttpError(400, 'Identifiant invalide', 'bad_id')
  return v.toLowerCase()
}
