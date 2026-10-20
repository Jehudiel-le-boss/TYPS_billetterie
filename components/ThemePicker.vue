<script setup lang="ts">
// Sélecteur compact (en-tête) : change le thème de TOUT le site en direct.
const { id, all, set } = useTheme(); const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({ top: '1rem', left: '1rem' })

async function positionMenu() {
  await nextTick()
  const triggerRect = trigger.value?.getBoundingClientRect()
  const menuElement = menu.value
  if (!triggerRect || !menuElement) return

  const menuRect = menuElement.getBoundingClientRect()
  const left = Math.min(Math.max(12, triggerRect.right - menuRect.width), window.innerWidth - menuRect.width - 12)
  const top = triggerRect.top >= menuRect.height + 12
    ? triggerRect.top - menuRect.height - 8
    : Math.min(triggerRect.bottom + 8, window.innerHeight - menuRect.height - 12)
  menuStyle.value = { top: `${Math.max(12, top)}px`, left: `${left}px` }
}

function onOutsidePointer(event: PointerEvent) {
  const target = event.target
  if (target instanceof Node && !trigger.value?.contains(target) && !menu.value?.contains(target)) open.value = false
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) open.value = false
}

watch(open, async (isOpen) => {
  if (!isOpen) return
  await positionMenu()
})
onMounted(() => {
  window.addEventListener('resize', positionMenu)
  window.addEventListener('scroll', positionMenu, true)
  document.addEventListener('pointerdown', onOutsidePointer)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', positionMenu)
  window.removeEventListener('scroll', positionMenu, true)
  document.removeEventListener('pointerdown', onOutsidePointer)
  document.removeEventListener('keydown', onKeydown)
})
</script>
<template>
  <div class="relative">
    <button ref="trigger" class="btn btn-ghost !min-h-[40px] px-3" :aria-expanded="open" aria-haspopup="listbox" aria-controls="theme-picker-list" aria-label="Changer de thème" @click="open = !open">
      <span class="h-4 w-4 rounded-full bg-gradient-to-br from-accent to-accent2" />Thème
    </button>
    <Teleport to="body">
      <div v-if="open" id="theme-picker-list" ref="menu" class="card fixed z-[90] grid max-h-[min(70dvh,34rem)] w-[min(20rem,calc(100vw-1.5rem))] grid-cols-2 gap-1.5 overflow-y-auto p-2 shadow-2xl" :style="menuStyle" role="listbox" aria-label="Choisir un thème">
        <button v-for="t in all" :key="t.id" role="option" :aria-selected="id === t.id" class="flex min-h-[44px] min-w-0 items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-line/50" :class="id === t.id ? 'ring-1 ring-accent' : ''" @click="set(t.id); open = false">
          <span class="h-5 w-5 shrink-0 rounded-full border border-white/20" :style="{ background: `linear-gradient(135deg, ${t.a}, ${t.b})` }" /><span class="truncate">{{ t.name }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
