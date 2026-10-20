<script setup lang="ts">
import { Bell } from '@lucide/vue'
const me = useMe(); const route = useRoute(); const unread = ref(0); const enabled = ref(false)
async function load() {
  if (!me.value.user) { unread.value = 0; enabled.value = false; return }
  try {
    const response = await api<{ enabled: boolean; unread: number }>('/api/notifications')
    enabled.value = response.enabled; unread.value = response.unread
  } catch (error) { useToast().err(errMsg(error)) }
}
onMounted(load)
watch(() => route.fullPath, load)
</script>
<template>
  <NuxtLink v-if="me.user && enabled" to="/app/notifications" class="btn btn-ghost relative !min-h-[40px] px-3" aria-label="Notifications">
    <Bell :size="17" /><span v-if="unread" class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-black text-bg">{{ unread > 99 ? '99+' : unread }}</span>
  </NuxtLink>
</template>
