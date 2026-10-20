<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Créer un compte', robots: 'noindex' })
const toast = useToast(); const f = reactive({ fullName: '', email: '', password: '' }); const intent = ref<'attend' | 'organize' | 'agent'>('attend'); const busy = ref(false); const verificationPending = ref(false); const verificationCode = ref('')
const destination = computed(() => ({ attend: '/events', organize: '/app', agent: '/scan' })[intent.value])
async function continueWithIntent() {
  if (intent.value === 'agent') toast.ok('Pour scanner, un organisateur doit d’abord t’inviter sur un événement.')
  await navigateTo(destination.value)
}
async function signUpGoogle() {
  busy.value = true
  try {
    const auth = await useNeonAuth()
    const callbackURL = new URL('/auth/verify', window.location.origin)
    callbackURL.searchParams.set('next', destination.value)
    const result = await auth.adapter.signIn.social({ provider: 'google', callbackURL: callbackURL.toString() })
    if (result.error) throw new Error(result.error.message || 'Inscription Google impossible')
    if (!result.data?.url) throw new Error('Neon Auth n’a pas fourni le lien de création de compte Google')
    window.location.assign(result.data.url)
  } catch (e) { toast.err(errMsg(e)); busy.value = false }
}
async function submit() {
  busy.value = true
  try {
    const auth = await useNeonAuth()
    const result = await auth.adapter.signUp.email({ name: f.fullName, email: f.email, password: f.password, callbackURL: `${window.location.origin}/auth/verify` })
    if (result.error) throw new Error(result.error.message || 'Création du compte impossible')
    if (!result.data?.user?.emailVerified) {
      verificationPending.value = true
      return
    }
    await syncNeonSession()
    toast.ok('Compte créé. Bienvenue sur TYPS !')
    await continueWithIntent()
  } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false }
}
async function resendVerification() {
  busy.value = true
  try {
    await sendNeonVerificationOtp(f.email)
    toast.ok('Un nouveau code a été demandé. Vérifie ta boîte de réception et les spams.')
  } catch (error) { toast.err(errMsg(error)) }
  finally { busy.value = false }
}
async function verifyEmail() {
  busy.value = true
  try {
    await verifyNeonEmailOtp(f.email, verificationCode.value.trim())
    const auth = await useNeonAuth()
    const result = await auth.adapter.signIn.email({ email: f.email, password: f.password })
    if (result.error) throw new Error(result.error.message || 'Adresse vérifiée, mais la connexion a échoué. Connecte-toi avec ton mot de passe.')
    await syncNeonSession()
    toast.ok('Adresse e-mail vérifiée. Bienvenue sur TYPS !')
    await continueWithIntent()
  } catch (error) { toast.err(errMsg(error)) }
  finally { busy.value = false }
}
</script>
<template>
  <h1 class="text-2xl font-black">Créer mon compte</h1><p class="mt-1 text-sm text-muted">Choisis par où commencer. Ce choix ne verrouille pas ton compte.</p>
  <div v-if="verificationPending" class="mt-6 space-y-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm" role="status">
    <p>Un code à 6 chiffres a été envoyé à <strong>{{ f.email }}</strong>. Saisis-le ci-dessous avant son expiration dans 10 minutes.</p>
    <form class="space-y-3" @submit.prevent="verifyEmail">
      <label class="block"><span class="label">Code reçu par e-mail</span><input v-model="verificationCode" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" minlength="6" required class="input text-center text-xl tracking-[0.4em]" aria-label="Code de vérification à 6 chiffres"></label>
      <button type="submit" class="btn btn-primary w-full" :disabled="busy">{{ busy ? 'Vérification…' : 'Vérifier mon adresse' }}</button>
    </form>
    <button type="button" class="btn btn-ghost w-full" :disabled="busy || !f.email" @click="resendVerification">{{ busy ? 'Envoi…' : 'Renvoyer un code' }}</button>
    <NuxtLink to="/auth/login" class="block text-center text-accent underline">J’ai déjà confirmé mon adresse : me connecter</NuxtLink>
  </div>
  <template v-else>
  <fieldset class="mt-6 space-y-3"><legend class="label">Comment veux-tu utiliser TYPS ?</legend>
    <label class="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-accent"><input v-model="intent" type="radio" value="attend" class="mt-1 accent-[rgb(var(--c-a))]"><span><strong class="block">Acheter des billets</strong><span class="text-sm text-muted">Découvrir des événements et retrouver mes billets.</span></span></label>
    <label class="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-accent"><input v-model="intent" type="radio" value="organize" class="mt-1 accent-[rgb(var(--c-a))]"><span><strong class="block">Créer des événements</strong><span class="text-sm text-muted">Créer une organisation, vendre des billets et gérer une équipe.</span></span></label>
    <label class="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-accent"><input v-model="intent" type="radio" value="agent" class="mt-1 accent-[rgb(var(--c-a))]"><span><strong class="block">Scanner des billets</strong><span class="text-sm text-muted">Un organisateur doit t’inviter et t’attribuer les droits d’accès.</span></span></label>
    <p class="hint">Ce choix indique seulement ton parcours de départ, pas une permission. Tu peux acheter des billets et aussi organiser des événements; tes rôles d’équipe peuvent différer selon chaque organisation ou événement.</p>
  </fieldset>
  <button type="button" class="btn mt-6 flex w-full items-center justify-center gap-3 border border-white/15" :disabled="busy" @click="signUpGoogle">
    <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.38 3.56v2.96h3.85c2.25-2.08 3.58-5.14 3.58-8.76Z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.93l-3.85-2.96c-1.08.72-2.46 1.15-4.1 1.15-3.15 0-5.82-2.13-6.77-5H1.26v3.05C3.24 21.25 7.3 24 12 24Z"/>
      <path fill="#FBBC05" d="M5.23 14.26a7.2 7.2 0 0 1 0-4.52V6.69H1.26a12 12 0 0 0 0 10.62l3.97-3.05Z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.36.61 4.61 1.82l3.44-3.44C17.95 1.19 15.24 0 12 0 7.3 0 3.24 2.75 1.26 6.69l3.97 3.05c.95-2.87 3.62-4.99 6.77-4.99Z"/>
    </svg>
    <span>Créer un compte avec Google</span>
  </button>
  <div class="my-5 flex items-center gap-3 text-xs text-muted"><span class="h-px flex-1 bg-white/10"></span><span>ou avec ton e-mail</span><span class="h-px flex-1 bg-white/10"></span></div>
  <form class="space-y-4" @submit.prevent="submit"><label class="block"><span class="label">Nom complet</span><input v-model="f.fullName" required minlength="2" autocomplete="name" class="input"></label><label class="block"><span class="label">E-mail</span><input v-model="f.email" type="email" required autocomplete="email" class="input"></label><label class="block"><span class="label">Mot de passe</span><input v-model="f.password" type="password" required minlength="10" autocomplete="new-password" class="input"><span class="hint">10 caractères minimum.</span></label><button class="btn btn-primary w-full" :disabled="busy">{{ busy ? 'Création…' : 'Créer mon compte' }}</button></form>
  <p class="mt-5 text-sm text-muted">Déjà un compte TYPS ? Crée ton compte Neon avec la même adresse e-mail vérifiée pour retrouver tes organisations et tes billets. <NuxtLink to="/auth/login" class="text-accent underline">Déjà sur Neon ? Connecte-toi</NuxtLink></p>
  </template>
</template>
