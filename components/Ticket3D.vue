<script setup lang="ts">
// Zone WebGL limitée au hero. Rendu de secours (TicketFace) géré par le parent si WebGL/mouvement indisponibles.
import { TresCanvas } from '@tresjs/core'
defineProps<{ title: string; name: string; a: string; b: string; bg: string; fg: string }>()
const pointer = reactive({ x: 0, y: 0 })
const move = (e: PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); pointer.x = ((e.clientX - r.left) / r.width - .5) * 2; pointer.y = ((e.clientY - r.top) / r.height - .5) * 2 }
</script>
<template>
  <div class="h-full w-full" role="img" aria-label="Billet TYPS en 3D, interactif" @pointermove="move" @pointerleave="pointer.x = 0; pointer.y = 0">
    <TresCanvas alpha :clear-alpha="0" :dpr="[1, 1.75]" power-preference="high-performance"><TicketScene :title="title" :name="name" :a="a" :b="b" :bg="bg" :fg="fg" :pointer="pointer" /></TresCanvas>
  </div>
</template>
