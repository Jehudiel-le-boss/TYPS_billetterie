import { createInternalNeonAuth, type NeonAuth } from '@neondatabase/auth'
import { BetterAuthVanillaAdapter, type BetterAuthVanillaAdapterInstance } from '@neondatabase/auth/vanilla/adapters'

type NeonAuthClient = NeonAuth<BetterAuthVanillaAdapterInstance>
let client: NeonAuthClient | undefined

export async function useNeonAuth(): Promise<NeonAuthClient> {
  if (!import.meta.client) throw new Error('Neon Auth est disponible uniquement dans le navigateur')
  if (client) return client
  const { baseUrl } = await api<{ baseUrl: string }>('/api/auth/config')
  const auth = createInternalNeonAuth<BetterAuthVanillaAdapterInstance>(baseUrl, { adapter: BetterAuthVanillaAdapter() })
  client = auth
  return auth
}

export async function syncNeonSession() {
  const auth = await useNeonAuth()
  const token = await auth.getJWTToken()
  if (!token) throw new Error('Aucune session Neon active. Connecte-toi à nouveau.')
  await api('/api/auth/neon-session', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  const me = await refreshMe()
  if (!me.user) throw new Error('La session TYPS n’a pas pu être créée. Réessaie de te connecter.')
  return me
}

export async function sendNeonVerificationOtp(email: string) {
  const auth = await useNeonAuth()
  const result = await auth.adapter.emailOtp.sendVerificationOtp({
    email,
    type: 'email-verification',
  })
  if (result.error) throw new Error(result.error.message || 'Impossible de renvoyer le code de vérification')
}

export async function verifyNeonEmailOtp(email: string, otp: string) {
  const auth = await useNeonAuth()
  const result = await auth.adapter.emailOtp.verifyEmail({ email, otp })
  if (result.error) throw new Error(result.error.message || 'Code de vérification invalide ou expiré')
  if (!result.data.status) throw new Error('Le code de vérification n’a pas été accepté')
}
