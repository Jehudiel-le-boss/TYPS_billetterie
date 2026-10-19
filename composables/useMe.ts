export interface Me { user: { id: string; email: string; fullName: string; platformRole: 'user' | 'admin'; emailVerified: boolean } | null; orgs?: { id: string; name: string; slug: string; role: string; currency: string; plan: string }[]; isAgent?: boolean }
export const useMe = () => useState<Me>('me', () => ({ user: null }))
export async function refreshMe() {
  const me = useMe()
  try { me.value = await api<Me>('/api/auth/me') } catch { me.value = { user: null } }
  return me.value
}
export function useOrg() {
  const me = useMe(); const cookie = useCookie<string | null>('typs_org', { sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  const orgs = computed(() => me.value.orgs ?? [])
  const current = computed(() => orgs.value.find((o) => o.id === cookie.value) ?? orgs.value[0] ?? null)
  return { orgs, current, select: (id: string) => { cookie.value = id } }
}
export async function logout() {
  let error: unknown
  try { await api('/api/auth/logout', { method: 'POST' }) } catch (e) { error = e }
  useMe().value = { user: null }
  try {
    const auth = await useNeonAuth()
    const result = await auth.adapter.signOut()
    if (result.error) throw new Error(result.error.message || 'Déconnexion Neon impossible')
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? e.code : undefined
    if (code !== 'neon_auth_not_configured') error ??= e
  }
  await navigateTo('/')
  if (error) useToast().err(errMsg(error))
}
