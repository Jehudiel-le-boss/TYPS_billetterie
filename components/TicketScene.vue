<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import * as THREE from 'three'
const props = defineProps<{ title: string; name: string; a: string; b: string; bg: string; fg: string; pointer: { x: number; y: number } }>()
const group = shallowRef<THREE.Group>(); const ring1 = shallowRef<THREE.Mesh>(); const ring2 = shallowRef<THREE.Mesh>()
function face() {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 740; const x = c.getContext('2d')!
  const g = x.createLinearGradient(0, 0, 1600, 740); g.addColorStop(0, props.bg); g.addColorStop(1, props.b + '66'); x.fillStyle = g; x.fillRect(0, 0, 1600, 740)
  x.fillStyle = props.a; x.fillRect(0, 0, 26, 740)
  x.fillStyle = props.a; x.font = '700 34px Figtree, sans-serif'; x.fillText('B I L L E T   T Y P S', 90, 120)
  x.fillStyle = props.fg; x.font = '700 92px Unbounded, Figtree, sans-serif'; x.fillText(props.title.slice(0, 20), 90, 260)
  x.font = '500 54px Figtree, sans-serif'; x.fillText(props.name, 90, 360); x.globalAlpha = .7; x.font = '400 40px Figtree, sans-serif'; x.fillText('12 déc. 2026 · 20:00 · Cotonou', 90, 640); x.globalAlpha = 1
  x.setLineDash([14, 14]); x.strokeStyle = props.fg + '88'; x.lineWidth = 4; x.beginPath(); x.moveTo(1190, 30); x.lineTo(1190, 710); x.stroke(); x.setLineDash([])
  x.fillStyle = '#fff'; x.fillRect(1260, 150, 280, 280); x.fillStyle = '#0a0a0a'; let s = 91
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { s = (s * 1103 + 12345) % 65521; if (s % 2 === 0 || (i < 3 && j < 3) || (i < 3 && j > 8) || (i > 8 && j < 3)) x.fillRect(1272 + j * 22.5, 162 + i * 22.5, 20, 20) }
  x.fillStyle = props.fg; x.font = '500 34px monospace'; x.fillText('TY-7K3M9QXA', 1285, 500)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
}
const tex = face()
const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  if (!group.value) return
  group.value.rotation.y += ((props.pointer.x * 0.55 + Math.sin(elapsed * .6) * .12) - group.value.rotation.y) * .06
  group.value.rotation.x += ((-props.pointer.y * 0.35 + Math.cos(elapsed * .5) * .06) - group.value.rotation.x) * .06
  group.value.position.y = Math.sin(elapsed * .9) * .08
  if (ring1.value) ring1.value.rotation.z = elapsed * .12; if (ring2.value) ring2.value.rotation.z = -elapsed * .08
})
</script>
<template>
  <TresPerspectiveCamera :position="[0, 0, 6.2]" :fov="38" />
  <TresAmbientLight :intensity="1.1" />
  <TresPointLight :position="[3, 3, 4]" :intensity="55" :color="a" />
  <TresPointLight :position="[-4, -2, 3]" :intensity="40" :color="b" />
  <TresGroup ref="group">
    <TresMesh><TresBoxGeometry :args="[4, 1.85, 0.07]" /><TresMeshStandardMaterial :color="bg" :metalness="0.7" :roughness="0.25" /></TresMesh>
    <TresMesh :position="[0, 0, 0.042]"><TresPlaneGeometry :args="[4, 1.85]" /><TresMeshBasicMaterial :map="tex" /></TresMesh>
    <TresMesh :position="[0, 0, -0.042]" :rotation="[0, Math.PI, 0]"><TresPlaneGeometry :args="[4, 1.85]" /><TresMeshStandardMaterial :color="b" :metalness="0.8" :roughness="0.3" /></TresMesh>
  </TresGroup>
  <TresMesh ref="ring1" :rotation="[1.15, 0.2, 0]"><TresTorusGeometry :args="[2.9, 0.012, 12, 160]" /><TresMeshBasicMaterial :color="a" /></TresMesh>
  <TresMesh ref="ring2" :rotation="[1.35, -0.3, 0.5]"><TresTorusGeometry :args="[3.3, 0.008, 12, 160]" /><TresMeshBasicMaterial :color="b" /></TresMesh>
</template>
