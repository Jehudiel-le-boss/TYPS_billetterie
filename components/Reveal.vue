<script setup lang="ts">
withDefaults(defineProps<{ delay?: number; y?: number; as?: string }>(), { delay: 0, y: 24, as: 'div' })
const reduced = useReducedMotion()
</script>
<template>
  <Motion :as="(as as any)" :initial="reduced ? false : { opacity: 0, y }" :while-in-view="{ opacity: 1, y: 0 }" :in-view-options="{ once: true, amount: 0.15 }" :transition="{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }"><slot /></Motion>
</template>
