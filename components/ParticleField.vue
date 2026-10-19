<script setup lang="ts">
const props = withDefaults(defineProps<{ intensity?: number; interactive?: boolean }>(), { intensity: 0.6, interactive: true })
const canvas = ref<HTMLCanvasElement>()
const reduced = useReducedMotion()
let raf = 0, stop = false
onMounted(() => {
  const c = canvas.value!, ctx = c.getContext('2d')!
  const mouse = { x: -999, y: -999 }; let w = 0, h = 0, dpr = 1, visible = true
  type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; hue: 0 | 1 }
  let ps: P[] = []
  const col = () => { const s = getComputedStyle(document.documentElement); return [s.getPropertyValue('--c-a').trim().replace(/ /g, ','), s.getPropertyValue('--c-b').trim().replace(/ /g, ',')] }
  let colors = col()
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2); w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const n = Math.round((w * h) / 14000 * props.intensity * (w < 640 ? 0.6 : 1))
    ps = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .25, vy: -Math.random() * .35 - .05, r: Math.random() * 1.6 + .4, a: Math.random() * .6 + .2, hue: Math.random() > .5 ? 1 : 0 }))
    colors = col()
  }
  const draw = () => {
    ctx.clearRect(0, 0, w, h)
    for (const p of ps) {
      if (!reduced.value) {
        p.x += p.vx; p.y += p.vy
        if (props.interactive) { const dx = p.x - mouse.x, dy = p.y - mouse.y, d = dx * dx + dy * dy; if (d < 9000) { p.x += dx * .02; p.y += dy * .02 } }
        if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w }; if (p.x < -5) p.x = w + 5; if (p.x > w + 5) p.x = -5
      }
      ctx.beginPath(); ctx.fillStyle = `rgba(${colors[p.hue]},${p.a})`; ctx.shadowColor = `rgba(${colors[p.hue]},.8)`; ctx.shadowBlur = 8; ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill()
    }
  }
  const loop = () => { if (stop) return; if (visible && !document.hidden) draw(); raf = requestAnimationFrame(loop) }
  const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting }); io.observe(c)
  const ro = new ResizeObserver(resize); ro.observe(c)
  const mv = (e: PointerEvent) => { const r = c.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top }
  window.addEventListener('pointermove', mv, { passive: true }); resize(); loop()
  onBeforeUnmount(() => { stop = true; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); window.removeEventListener('pointermove', mv) })
})
</script>
<template><canvas ref="canvas" class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" /></template>
