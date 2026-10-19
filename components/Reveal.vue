<script setup lang="ts">
const props = withDefaults(defineProps<{ delay?: number; y?: number; as?: string }>(), { delay: 0, y: 24, as: 'div' })
const reduced = useReducedMotion()
const visible = ref(true)
const target = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
const style = computed(() => ({
  opacity: visible.value ? 1 : 0,
  transform: visible.value ? 'translateY(0)' : `translateY(${props.y}px)`,
  transition: reduced.value ? 'none' : `opacity 650ms cubic-bezier(0.22, 1, 0.36, 1) ${visible.value ? props.delay : 0}s, transform 650ms cubic-bezier(0.22, 1, 0.36, 1) ${visible.value ? props.delay : 0}s`
}))

onMounted(() => {
  const element = target.value
  if (!element || reduced.value) return
  const rect = element.getBoundingClientRect()
  if (rect.top < window.innerHeight && rect.bottom > 0) return

  visible.value = false
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      visible.value = true
      observer?.disconnect()
    }
  }, { threshold: 0.01 })
  observer.observe(element)
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <component :is="props.as" ref="target" :style="style"><slot /></component>
</template>
