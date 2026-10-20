<script setup lang="ts">
import { Camera, KeyRound, LoaderCircle, Save, Trash2, UserRound } from '@lucide/vue'
interface Profile { fullName: string; phone: string; locale: string; avatarUrl: string | null }
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Mon profil', robots: 'noindex' })
const me = useMe(); const toast = useToast()
const { data: profile, refresh, pending } = await useAsyncData('account-profile', () => api<Profile>('/api/auth/profile'), { server: false })
const form = reactive({ fullName: '', phone: '' }); watch(profile, (value) => { if (value) { form.fullName = value.fullName; form.phone = value.phone } }, { immediate: true })
const busy = ref(false); const fileInput = ref<HTMLInputElement>()
async function save() {
  busy.value = true
  try { const saved = await api<Pick<Profile, 'fullName' | 'phone'>>('/api/auth/profile', { method: 'PATCH', body: form }); form.fullName = saved.fullName; form.phone = saved.phone; if (me.value.user) me.value.user.fullName = saved.fullName; toast.ok('Profil mis à jour') }
  catch (error) { toast.err(errMsg(error)) }
  finally { busy.value = false }
}
async function uploadAvatar(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  busy.value = true
  try { const body = new FormData(); body.append('file', file); await api('/api/auth/avatar', { method: 'POST', body }); await refresh(); toast.ok('Photo de profil mise à jour') }
  catch (error) { toast.err(errMsg(error)) }
  finally { busy.value = false; if (fileInput.value) fileInput.value.value = '' }
}
async function removeAvatar() {
  busy.value = true
  try { await api('/api/auth/avatar', { method: 'DELETE' }); await refresh(); toast.ok('Photo de profil supprimée') }
  catch (error) { toast.err(errMsg(error)) }
  finally { busy.value = false }
}
</script>
<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div><p class="flex items-center gap-2 text-sm font-semibold text-accent"><UserRound :size="16" />Compte TYPS</p><h1 class="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-black">Mon profil</h1><p class="mt-2 text-sm text-muted">Gère les informations visibles dans ton espace et auprès de ton équipe.</p></div>
    <div v-if="pending && !profile" class="skeleton h-64" />
    <template v-else-if="profile">
      <section class="card flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
        <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="Photo de profil" class="h-24 w-24 rounded-full border border-line object-cover">
        <div v-else class="flex h-24 w-24 items-center justify-center rounded-full border border-line bg-surface text-muted"><UserRound :size="36" /></div>
        <div class="flex-1"><h2 class="font-bold">Photo de profil</h2><p class="mt-1 text-sm text-muted">PNG ou JPEG, 4 Mo maximum. Elle est stockée de façon privée.</p></div>
        <input ref="fileInput" type="file" accept="image/png,image/jpeg" class="sr-only" @change="uploadAvatar">
        <div class="flex flex-wrap gap-2"><button class="btn btn-ghost" :disabled="busy" @click="fileInput?.click()"><Camera :size="16" />{{ profile.avatarUrl ? 'Changer la photo' : 'Ajouter une photo' }}</button><button v-if="profile.avatarUrl" class="btn btn-ghost text-red-300" :disabled="busy" @click="removeAvatar"><Trash2 :size="16" />Supprimer la photo</button></div>
      </section>
      <form class="card space-y-5 p-6" @submit.prevent="save">
        <label class="block"><span class="label">Nom complet</span><input v-model.trim="form.fullName" required minlength="2" maxlength="120" autocomplete="name" class="input"></label>
        <label class="block"><span class="label">Téléphone (facultatif)</span><input v-model.trim="form.phone" maxlength="30" autocomplete="tel" class="input"></label>
        <div><span class="label">Adresse e-mail</span><p class="input flex items-center text-muted">{{ me.user?.email }}</p><p class="hint">Pour modifier l’adresse de connexion, passe par la gestion de compte Neon Auth.</p></div>
        <div class="flex flex-wrap gap-3"><button class="btn btn-primary" :disabled="busy"><LoaderCircle v-if="busy" class="animate-spin" :size="16" /><Save v-else :size="16" />Enregistrer le profil</button><NuxtLink to="/auth/forgot" class="btn btn-ghost"><KeyRound :size="16" />Changer le mot de passe</NuxtLink></div>
      </form>
    </template>
  </div>
</template>
