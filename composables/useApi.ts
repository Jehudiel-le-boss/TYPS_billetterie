export interface ApiValidationIssue { path: (string | number)[]; message: string }
export interface ApiError extends Error { status?: number; code?: string; issues?: ApiValidationIssue[] }
export async function api<T = any>(url: string, opts: Record<string, any> = {}): Promise<T> {
  try {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}
    return await $fetch<T>(url, { ...opts, headers: { ...headers, ...(opts.headers ?? {}) } })
  } catch (e: any) {
    const err: ApiError = new Error(e?.data?.statusMessage || e?.statusMessage || 'Une erreur est survenue. Réessayez.')
    err.status = e?.statusCode ?? e?.status; err.code = e?.data?.data?.code
    const issues = e?.data?.data?.issues
    if (Array.isArray(issues)) {
      err.issues = issues.filter((issue: unknown): issue is ApiValidationIssue => {
        if (!issue || typeof issue !== 'object') return false
        const value = issue as Partial<ApiValidationIssue>
        return Array.isArray(value.path) && typeof value.message === 'string'
      })
    }
    throw err
  }
}
export function errMsg(e: unknown) { return (e as Error)?.message || 'Une erreur est survenue' }
