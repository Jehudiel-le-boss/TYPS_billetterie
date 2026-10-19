<script setup lang="ts">
const { list, dismiss } = useToast()
</script>
<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
    <TransitionGroup name="page">
      <button v-for="t in list" :key="t.id" class="pointer-events-auto max-w-md rounded-2xl border px-4 py-3 text-left text-sm font-medium shadow-deep backdrop-blur-xl"
        :class="t.kind === 'err' ? 'border-red-500/50 bg-red-950/80 text-red-100' : t.kind === 'ok' ? 'border-emerald-500/50 bg-emerald-950/80 text-emerald-100' : 'border-line bg-surface/90 text-fg'" @click="dismiss(t.id)">{{ t.msg }}</button>
    </TransitionGroup>
  </div>
</template>
