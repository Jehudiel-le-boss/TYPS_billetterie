<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Connexion', robots: 'noindex' })
const route = useRoute(); const toast = useToast(); const f = reactive({ email: '', password: '' }); const busy = ref(false); const verificationPending = ref(false); const verificationCode = ref('')
const nextPath = computed(() => {
  const next = String(route.query.next ?? '')
  return next.startsWith('/') && !next.startsWith('//') ? next : '/app'
})
async function submit() { busy.value = true; try { const auth = await useNeonAuth(); const result = await auth.adapter.signIn.email(f); if (result.error) throw new Error(result.error.message || 'Connexion impossible'); await syncNeonSession(); await navigateTo(nextPath.value) } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false } }
async function resendVerification() {
  if (!f.email.trim()) { toast.err('Saisis ton adresse e-mail pour demander un nouveau lien.'); return }
  busy.value = true
  try {
    await sendNeonVerificationOtp(f.email)
    verificationPending.value = true
    toast.ok('Un code de vérification a été demandé. Vérifie ta boîte de réception et les spams.')
  } catch (e) { toast.err(errMsg(e)) }
  finally { busy.value = false }
}
async function verifyEmail() {
  busy.value = true
  try {
    await verifyNeonEmailOtp(f.email, verificationCode.value.trim())
    if (!f.password) {
      verificationPending.value = false
      toast.ok('Adresse vérifiée. Saisis ton mot de passe pour te connecter.')
      return
    }
    const auth = await useNeonAuth()
    const result = await auth.adapter.signIn.email({ email: f.email, password: f.password })
    if (result.error) throw new Error(result.error.message || 'Adresse vérifiée, mais la connexion a échoué. Vérifie ton mot de passe.')
    await syncNeonSession()
    await navigateTo(nextPath.value)
  } catch (e) { toast.err(errMsg(e)) }
  finally { busy.value = false }
}
async function signInGoogle() {
  busy.value = true
  try {
    const auth = await useNeonAuth()
    const callbackURL = new URL('/auth/verify', window.location.origin)
    callbackURL.searchParams.set('next', nextPath.value)
    const result = await auth.adapter.signIn.social({ provider: 'google', callbackURL: callbackURL.toString() })
    if (result.error) throw new Error(result.error.message || 'Connexion Google impossible')
    if (!result.data?.url) throw new Error('Neon Auth n’a pas fourni le lien de connexion Google')
    window.location.assign(result.data.url)
  } catch (e) { toast.err(errMsg(e)); busy.value = false }
}
</script>
<template>
  <h1 class="text-2xl font-black">Connexion</h1><p class="mt-1 text-sm text-muted">Retrouve tes événements et tes billets.</p>
  <button type="button" class="btn mt-6 flex w-full items-center justify-center gap-3 border border-white/15" :disabled="busy" @click="signInGoogle">
    <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.38 3.56v2.96h3.85c2.25-2.08 3.58-5.14 3.58-8.76Z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.93l-3.85-2.96c-1.08.72-2.46 1.15-4.1 1.15-3.15 0-5.82-2.13-6.77-5H1.26v3.05C3.24 21.25 7.3 24 12 24Z"/>
      <path fill="#FBBC05" d="M5.23 14.26a7.2 7.2 0 0 1 0-4.52V6.69H1.26a12 12 0 0 0 0 10.62l3.97-3.05Z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.36.61 4.61 1.82l3.44-3.44C17.95 1.19 15.24 0 12 0 7.3 0 3.24 2.75 1.26 6.69l3.97 3.05c.95-2.87 3.62-4.99 6.77-4.99Z"/>
    </svg>
    <span>Continuer avec Google</span>
  </button>
  <div class="my-5 flex items-center gap-3 text-xs text-muted"><span class="h-px flex-1 bg-white/10"></span><span>ou avec ton e-mail</span><span class="h-px flex-1 bg-white/10"></span></div>
  <form class="space-y-4" @submit.prevent="submit"><label class="block"><span class="label">E-mail</span><input v-model="f.email" type="email" required autocomplete="email" class="input"></label><label class="block"><span class="label">Mot de passe</span><input v-model="f.password" type="password" required autocomplete="current-password" class="input"></label><button class="btn btn-primary w-full" :disabled="busy">{{ busy ? 'Connexion…' : 'Se connecter' }}</button></form>
  <button type="button" class="mt-4 w-full text-sm text-accent underline disabled:opacity-50" :disabled="busy" @click="resendVerification">{{ verificationPending ? 'Renvoyer un code' : 'Adresse non vérifiée ou code non reçu ? Recevoir un code' }}</button>
  <form v-if="verificationPending" class="mt-4 space-y-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4" @submit.prevent="verifyEmail">
    <label class="block"><span class="label">Code à 6 chiffres reçu par e-mail</span><input v-model="verificationCode" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" minlength="6" required class="input text-center text-xl tracking-[0.4em]" aria-label="Code de vérification à 6 chiffres"></label>
    <button type="submit" class="btn btn-primary w-full" :disabled="busy">{{ busy ? 'Vérification…' : 'Vérifier et se connecter' }}</button>
  </form>
  <div class="mt-5 flex justify-between text-sm"><NuxtLink to="/auth/forgot" class="text-accent underline">Mot de passe oublié ?</NuxtLink><NuxtLink to="/auth/register" class="text-accent underline">Créer un compte</NuxtLink></div>
</template>
