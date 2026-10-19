<script setup lang="ts">
// Caméra + décodage QR (BarcodeDetector natif sinon jsQR). L'autorisation caméra n'est demandée qu'au clic.
const emit = defineEmits<{ decode: [text: string]; error: [msg: string] }>()
const video = ref<HTMLVideoElement>(); const on = ref(false); const devices = ref<MediaDeviceInfo[]>([]); const deviceId = ref(''); const denied = ref(false)
let stream: MediaStream | null = null, raf = 0, last = '', lastAt = 0
const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
async function start(id?: string) {
  stop(); denied.value = false
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: { exact: id } } : { facingMode: { ideal: 'environment' } }, audio: false })
    video.value!.srcObject = stream; await video.value!.play(); on.value = true
    devices.value = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); deviceId.value = stream.getVideoTracks()[0]?.getSettings().deviceId ?? ''
    loop()
  } catch (e) { denied.value = true; emit('error', (e as Error).name === 'NotAllowedError' ? 'Accès caméra refusé. Autorisez la caméra dans le navigateur, ou utilisez la saisie manuelle.' : 'Caméra indisponible sur cet appareil.') }
}
function stop() { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); stream = null; on.value = false }
async function loop() {
  const v = video.value; if (!v || !stream) return
  const BD = (globalThis as any).BarcodeDetector; const det = BD ? new BD({ formats: ['qr_code'] }) : null
  const jsQR = det ? null : (await import('jsqr')).default
  const tick = async () => {
    if (!stream) return
    if (v.readyState >= 2) {
      let text = ''
      try {
        if (det) text = (await det.detect(v))[0]?.rawValue ?? ''
        else if (canvas) { const w = 480, h = Math.round((480 * v.videoHeight) / v.videoWidth) || 360; canvas.width = w; canvas.height = h; const x = canvas.getContext('2d', { willReadFrequently: true })!; x.drawImage(v, 0, 0, w, h); text = jsQR!(x.getImageData(0, 0, w, h).data, w, h)?.data ?? '' }
      } catch { /* image non prête */ }
      const now = Date.now(); if (text && (text !== last || now - lastAt > 2500)) { last = text; lastAt = now; emit('decode', text) }
    }
    raf = window.setTimeout(() => requestAnimationFrame(tick), 90) as unknown as number
  }
  tick()
}
onBeforeUnmount(stop)
defineExpose({ stop, start })
</script>
<template>
  <div class="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-[28px] border border-line bg-black sm:aspect-square">
    <video ref="video" class="h-full w-full object-cover" playsinline muted />
    <div v-if="on" class="pointer-events-none absolute inset-[12%] rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,.45)]">
      <span class="scan-line absolute inset-x-3 h-0.5 rounded bg-accent shadow-[0_0_14px_rgb(var(--c-a))]" />
    </div>
    <div v-if="!on" class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p class="text-sm text-white/80">{{ denied ? 'Caméra non autorisée.' : 'La caméra n’est activée qu’avec votre accord.' }}</p>
      <button class="btn btn-primary" @click="start()">Autoriser la caméra</button>
    </div>
    <select v-if="on && devices.length > 1" v-model="deviceId" class="absolute bottom-3 left-3 right-3 rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-sm text-white" aria-label="Choisir la caméra" @change="start(deviceId)">
      <option v-for="d in devices" :key="d.deviceId" :value="d.deviceId">{{ d.label || 'Caméra' }}</option>
    </select>
  </div>
</template>
