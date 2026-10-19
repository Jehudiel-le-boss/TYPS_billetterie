<script setup lang="ts">
// Éditeur visuel de billets : glisser-déposer, redimensionnement, calques, magnétisme, annulation, import PNG/JPG/PDF, enregistrement auto.
import { FIELD_LABELS, FIELD_KEYS, PRINT_FORMATS, SAMPLE_CONTEXT, uid, type TemplateLayout, type TplElement } from '~~/shared/template'
import { THEMES } from '~~/shared/themes'
const props = defineProps<{ templateId: string }>()
const toast = useToast()
const tpl = ref<{ id: string; name: string; organizationId: string; published: boolean } | null>(null)
const layout = ref<TemplateLayout>(null as unknown as TemplateLayout)
const sel = ref<string | null>(null); const zoom = ref(0.8); const grid = ref(true); const SNAP = 10
const mode = ref<'edit' | 'desktop' | 'mobile'>('edit')
const saveState = ref<'saved' | 'saving' | 'dirty' | 'error'>('saved'); const savedAt = ref<Date | null>(null)
const past = ref<string[]>([]), future = ref<string[]>([]); const guides = ref<{ axis: 'x' | 'y'; pos: number }[]>([])
const assets = ref<Record<string, string>>({}); const qr = ref<Record<string, string>>({}); let ready = false
const stageBox = ref<HTMLElement>()

const { data, error } = await useAsyncData(`tpl-${props.templateId}`, () => api(`/api/templates/${props.templateId}`), { server: false })
watchEffect(() => { if (data.value && !layout.value) { tpl.value = data.value; layout.value = data.value.layout; nextTick(() => { ready = true; fit(); loadAssets() }) } })
const el = computed(() => layout.value?.elements.find((e) => e.id === sel.value) as any)
const label = (e: any) => e.name || (e.type === 'field' ? FIELD_LABELS[e.field as keyof typeof FIELD_LABELS] : e.type === 'text' ? e.text.slice(0, 22) || 'Texte' : e.type === 'qr' ? 'QR code' : e.type === 'image' ? 'Image' : e.shape === 'ellipse' ? 'Ellipse' : 'Rectangle')

const snapshot = () => { past.value.push(JSON.stringify(layout.value)); if (past.value.length > 80) past.value.shift(); future.value = [] }
const undo = () => { const p = past.value.pop(); if (!p) return; future.value.push(JSON.stringify(layout.value)); layout.value = JSON.parse(p); sel.value = null }
const redo = () => { const n = future.value.pop(); if (!n) return; past.value.push(JSON.stringify(layout.value)); layout.value = JSON.parse(n) }
let timer: ReturnType<typeof setTimeout>
watch(layout, () => { if (!ready) return; saveState.value = 'dirty'; clearTimeout(timer); timer = setTimeout(save, 1200); refreshQr() }, { deep: true })
watch(tpl, () => {}, { deep: true })
async function save() {
  saveState.value = 'saving'
  try { await api(`/api/templates/${props.templateId}`, { method: 'PUT', body: { name: tpl.value!.name, layout: layout.value } }); saveState.value = 'saved'; savedAt.value = new Date() } catch (e) { saveState.value = 'error'; toast.err(errMsg(e)) }
}
async function refreshQr() { qr.value = await qrMapFor(layout.value) }
async function loadAssets() { await refreshQr(); const ids = [layout.value.background.assetId, ...layout.value.elements.map((x) => (x.type === 'image' ? x.assetId : null))].filter(Boolean) as string[]; for (const id of ids) if (!assets.value[id]) api<{ url: string }>(`/api/assets/${id}/url`).then((r) => { assets.value[id] = r.url }).catch(() => {}) }
function fit() { const w = stageBox.value?.clientWidth ?? 800; zoom.value = Math.min(1.4, Math.max(0.2, (w - 48) / layout.value.width)) }

function add(e: Partial<TplElement> & { type: TplElement['type'] }) { snapshot(); const base = { id: uid(), x: 60, y: 60, w: 240, h: 40, opacity: 1 }; const full = { ...base, ...e } as TplElement; layout.value.elements.push(full); sel.value = full.id }
const txt = { fontSize: 22, font: 'sans', bold: false, color: '#ffffff', align: 'left' }
const addField = (f: string) => add({ type: 'field', field: f, ...txt } as any)
const addText = () => add({ type: 'text', text: 'Votre texte', ...txt } as any)
const addShape = (shape: 'rect' | 'ellipse') => add({ type: 'shape', shape, w: 160, h: 80, fill: '#22d3ee', stroke: '#000000', strokeWidth: 0, radius: shape === 'rect' ? 12 : 0 } as any)
const addQr = () => add({ type: 'qr', w: 160, h: 160, fg: '#000000', bg: '#ffffff', quiet: true } as any)
const del = () => { if (!sel.value) return; snapshot(); layout.value.elements = layout.value.elements.filter((e) => e.id !== sel.value); sel.value = null }
const dup = () => { if (!el.value) return; snapshot(); const c = { ...JSON.parse(JSON.stringify(el.value)), id: uid(), x: el.value.x + 20, y: el.value.y + 20 }; layout.value.elements.push(c); sel.value = c.id }
function order(dir: 'up' | 'down' | 'front' | 'back') { const a = layout.value.elements, i = a.findIndex((e) => e.id === sel.value); if (i < 0) return; snapshot(); const [x] = a.splice(i, 1); const j = dir === 'up' ? Math.min(a.length, i + 1) : dir === 'down' ? Math.max(0, i - 1) : dir === 'front' ? a.length : 0; a.splice(j, 0, x!) }
function alignTo(where: 'l' | 'c' | 'r' | 't' | 'm' | 'b') { const e = el.value; if (!e) return; snapshot(); const L = layout.value; if (where === 'l') e.x = 0; if (where === 'c') e.x = Math.round((L.width - e.w) / 2); if (where === 'r') e.x = L.width - e.w; if (where === 't') e.y = 0; if (where === 'm') e.y = Math.round((L.height - e.h) / 2); if (where === 'b') e.y = L.height - e.h }

// Glisser-déposer et redimensionnement avec magnétisme (grille + bords/centres du billet et des autres éléments)
type Drag = { id: string; mode: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number }
let drag: Drag | null = null
function snapAxis(vals: number[], cands: number[], tol = 5) { let best: { d: number; to: number } | null = null; for (const v of vals) for (const c of cands) { const d = c - v; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, to: c } } return best }
function startDrag(ev: PointerEvent, e: any, m = 'move') { ev.preventDefault(); sel.value = e.id; snapshot(); drag = { id: e.id, mode: m, sx: ev.clientX, sy: ev.clientY, ox: e.x, oy: e.y, ow: e.w, oh: e.h }; window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', endDrag, { once: true }) }
function onMove(ev: PointerEvent) {
  if (!drag) return; const e = layout.value.elements.find((x) => x.id === drag!.id) as any; if (!e) return
  const dx = (ev.clientX - drag.sx) / zoom.value, dy = (ev.clientY - drag.sy) / zoom.value, L = layout.value, others = L.elements.filter((o) => o.id !== e.id && !o.hidden)
  const xc = [0, L.width / 2, L.width, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])], yc = [0, L.height / 2, L.height, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])]
  guides.value = []
  if (drag.mode === 'move') {
    let nx = drag.ox + dx, ny = drag.oy + dy
    const sx = snapAxis([nx, nx + e.w / 2, nx + e.w], xc), sy = snapAxis([ny, ny + e.h / 2, ny + e.h], yc)
    if (sx) { nx += sx.d; guides.value.push({ axis: 'x', pos: sx.to }) } else if (grid.value) nx = Math.round(nx / SNAP) * SNAP
    if (sy) { ny += sy.d; guides.value.push({ axis: 'y', pos: sy.to }) } else if (grid.value) ny = Math.round(ny / SNAP) * SNAP
    e.x = Math.round(nx); e.y = Math.round(ny)
  } else {
    let { ox: x, oy: y, ow: w, oh: h } = drag; const m = drag.mode
    if (m.includes('e')) w = Math.max(10, drag.ow + dx); if (m.includes('s')) h = Math.max(10, drag.oh + dy)
    if (m.includes('w')) { w = Math.max(10, drag.ow - dx); x = drag.ox + drag.ow - w }; if (m.includes('n')) { h = Math.max(10, drag.oh - dy); y = drag.oy + drag.oh - h }
    if (grid.value) { w = Math.round(w / SNAP) * SNAP || SNAP; h = Math.round(h / SNAP) * SNAP || SNAP }
    if (e.type === 'qr') { const s = Math.max(w, h); w = h = s }
    Object.assign(e, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) })
  }
}
function endDrag() { drag = null; guides.value = []; window.removeEventListener('pointermove', onMove) }
function onKey(ev: KeyboardEvent) {
  const t = ev.target as HTMLElement; if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return
  const mod = ev.ctrlKey || ev.metaKey
  if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) redo(); else undo() } else if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo() } else if (mod && ev.key.toLowerCase() === 'd') { ev.preventDefault(); dup() }
  else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); del() }
  else if (el.value && ev.key.startsWith('Arrow')) { ev.preventDefault(); snapshot(); const s = ev.shiftKey ? 10 : 1; if (ev.key === 'ArrowLeft') el.value.x -= s; if (ev.key === 'ArrowRight') el.value.x += s; if (ev.key === 'ArrowUp') el.value.y -= s; if (ev.key === 'ArrowDown') el.value.y += s }
}

// Import de modèles (PNG / JPG / PDF multipage avec choix de la page)
const fileIn = ref<HTMLInputElement>(); const logoIn = ref<HTMLInputElement>(); const uploading = ref(false); const fitFormat = ref(true)
const pdf = reactive<{ open: boolean; doc: any; pages: number; page: number; buf: ArrayBuffer | null }>({ open: false, doc: null, pages: 1, page: 1, buf: null }); const pdfCanvas = ref<HTMLCanvasElement>()
async function upload(blob: Blob, kind: string, name = 'image.png') { const fd = new FormData(); fd.append('orgId', tpl.value!.organizationId); fd.append('kind', kind); fd.append('file', blob, name); uploading.value = true; try { const r = await $fetch<any>('/api/uploads', { method: 'POST', body: fd }); assets.value[r.id] = r.url; return r } catch (e: any) { toast.err(e?.data?.statusMessage || 'Téléversement refusé'); return null } finally { uploading.value = false } }
async function onBackground(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]; (ev.target as HTMLInputElement).value = ''; if (!f) return
  if (f.size > 12 * 1024 * 1024) return toast.err('Fichier trop volumineux (12 Mo maximum)')
  if (f.type === 'application/pdf') return openPdf(f)
  if (!['image/png', 'image/jpeg'].includes(f.type)) return toast.err('Formats acceptés : PNG, JPG, PDF')
  const r = await upload(f, 'background', f.name); if (r) setBackground(r)
}
function setBackground(r: { id: string; width: number; height: number }) { snapshot(); layout.value.background.assetId = r.id; if (fitFormat.value) { const w = Math.min(1200, r.width); layout.value.width = w; layout.value.height = Math.round((w * r.height) / r.width); nextTick(fit) } }
async function openPdf(f: File) {
  try {
    const pdfjs = await import('pdfjs-dist'); pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    const buf = await f.arrayBuffer(); const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise
    Object.assign(pdf, { open: true, doc, pages: doc.numPages, page: 1, buf }); await nextTick(); renderPdf(0.5)
  } catch { toast.err('PDF illisible ou protégé') }
}
async function renderPdf(scale: number, c = pdfCanvas.value) { const page = await pdf.doc.getPage(pdf.page); const vp0 = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: scale === 0.5 ? 360 / vp0.width : Math.min(2400, 1800) / vp0.width }); const cv = c ?? document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; await page.render({ canvasContext: cv.getContext('2d')!, viewport: vp, canvas: cv } as any).promise; return cv }
watch(() => pdf.page, () => { if (pdf.open) renderPdf(0.5) })
async function usePdfPage() { const cv = await renderPdf(1); const blob: Blob | null = await new Promise((r) => cv.toBlob(r, 'image/png')); if (!blob) return; const r = await upload(blob, 'background', 'pdf-page.png'); pdf.open = false; if (r) setBackground(r) }
async function onLogo(ev: Event) { const f = (ev.target as HTMLInputElement).files?.[0]; (ev.target as HTMLInputElement).value = ''; if (!f) return; const r = await upload(f, 'logo', f.name); if (r) add({ type: 'image', assetId: r.id, w: 120, h: Math.round((120 * r.height) / r.width), fit: 'contain' } as any) }

function applyTheme(id: string) { const t = THEMES.find((x) => x.id === id); if (!t) return; snapshot(); const L = layout.value; if (!L.background.assetId) L.background.color = t.bg
  L.elements.forEach((e: any, i) => { if (e.type === 'text' || e.type === 'field') e.color = ['category', 'vip_badge'].includes(e.field) ? t.a : t.fg; if (e.type === 'shape') e.fill = i % 2 ? t.b : t.a }) }
function setFormat(id: string) { const f = PRINT_FORMATS.find((x) => x.id === id); if (!f) return; snapshot(); layout.value.width = f.width; layout.value.height = f.height; nextTick(fit) }
const formatId = computed(() => PRINT_FORMATS.find((f) => f.width === layout.value?.width && f.height === layout.value?.height)?.id ?? 'custom')

// Test du QR : génère le QR avec les couleurs choisies puis tente de le décoder
const qrTest = reactive<{ open: boolean; ok: boolean | null; ratio: number; url: string }>({ open: false, ok: null, ratio: 0, url: '' })
async function testQr() { const q = layout.value.elements.find((e) => e.type === 'qr') as any; if (!q) return toast.err('Ajoutez d’abord un QR code'); const url = await qrFor(SAMPLE_QR, q.fg, q.bg, q.quiet); Object.assign(qrTest, { open: true, url, ratio: contrastRatio(q.fg, q.bg), ok: null }); qrTest.ok = (await decodeQrDataUrl(url)) === SAMPLE_QR }
async function publish() { await save(); try { const r = await api<{ version: number }>(`/api/templates/${props.templateId}/publish`, { method: 'POST' }); tpl.value!.published = true; toast.ok(`Version ${r.version} publiée : les prochains billets l’utiliseront`) } catch (e) { toast.err(errMsg(e)) } }
onBeforeUnmount(() => { clearTimeout(timer); if (saveState.value === 'dirty') save() })
const stateText = computed(() => ({ saved: savedAt.value ? `Enregistré à ${savedAt.value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'À jour', saving: 'Enregistrement…', dirty: 'Modifications non enregistrées', error: 'Échec de l’enregistrement' })[saveState.value])
const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const hpos = (h: string) => ({ left: h.includes('w') ? '0%' : h.includes('e') ? '100%' : '50%', top: h.includes('n') ? '0%' : h.includes('s') ? '100%' : '50%', cursor: `${h}-resize` })
</script>

<template>
  <div v-if="error" class="p-8"><UiEmpty title="Modèle introuvable" text="Il n’existe pas ou vous n’y avez pas accès." /></div>
  <div v-else-if="!layout" class="p-8"><div class="skeleton h-[60vh]" /></div>
  <div v-else class="flex h-[calc(100dvh-4rem)] min-h-[560px] flex-col" @keydown="onKey">
    <!-- Barre d'outils -->
    <div class="flex flex-wrap items-center gap-2 border-b border-line bg-surface/60 px-3 py-2 backdrop-blur">
      <NuxtLink to="/app/studio" class="btn btn-ghost !min-h-[40px] px-3" aria-label="Retour au Studio">←</NuxtLink>
      <input v-model="tpl!.name" class="input !min-h-[40px] max-w-[220px] font-semibold" aria-label="Nom du modèle" @change="saveState = 'dirty'; save()">
      <div class="mx-1 hidden h-6 w-px bg-line sm:block" />
      <button class="btn btn-ghost !min-h-[40px] px-3" :disabled="!past.length" title="Annuler (Ctrl+Z)" @click="undo">Annuler</button>
      <button class="btn btn-ghost !min-h-[40px] px-3" :disabled="!future.length" title="Rétablir (Ctrl+Y)" @click="redo">Rétablir</button>
      <div class="flex items-center gap-1"><button class="btn btn-ghost !min-h-[40px] px-3" aria-label="Zoom arrière" @click="zoom = Math.max(0.2, zoom - 0.1)">−</button><span class="w-12 text-center text-sm tabular-nums">{{ Math.round(zoom * 100) }}%</span><button class="btn btn-ghost !min-h-[40px] px-3" aria-label="Zoom avant" @click="zoom = Math.min(2, zoom + 0.1)">+</button><button class="btn btn-ghost !min-h-[40px] px-3" @click="fit">Ajuster</button></div>
      <label class="flex min-h-[40px] items-center gap-2 text-sm"><input v-model="grid" type="checkbox" class="h-4 w-4 accent-[rgb(var(--c-a))]"> Grille / magnétisme</label>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <span class="text-sm" :class="saveState === 'error' ? 'text-red-400' : 'text-muted'" role="status">{{ stateText }}</span>
        <div class="flex overflow-hidden rounded-full border border-line"><button v-for="m in [['edit', 'Éditeur'], ['desktop', 'Aperçu PC'], ['mobile', 'Aperçu mobile']]" :key="m[0]" class="min-h-[40px] px-3 text-sm font-semibold" :class="mode === m[0] ? 'bg-accent text-[color:var(--on-accent,#05050a)]' : 'text-muted hover:text-fg'" @click="mode = m[0] as any">{{ m[1] }}</button></div>
        <button class="btn btn-ghost !min-h-[40px]" @click="testQr">Tester le QR</button>
        <a class="btn btn-ghost !min-h-[40px]" :href="`/api/templates/${templateId}/preview-pdf`" target="_blank" rel="noopener">PDF d’essai</a>
        <button class="btn btn-primary !min-h-[40px]" @click="publish">Publier la version</button>
      </div>
    </div>

    <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[270px_1fr_300px]">
      <!-- Éléments -->
      <aside class="order-2 max-h-[40vh] overflow-y-auto border-line bg-surface/40 p-3 lg:order-1 lg:max-h-none lg:border-r" aria-label="Éléments du billet">
        <p class="label">Champs dynamiques</p>
        <div class="grid grid-cols-2 gap-1.5"><button v-for="f in FIELD_KEYS.filter((k) => k !== 'organizer_logo')" :key="f" class="rounded-lg border border-line px-2 py-2 text-left text-xs font-medium hover:border-accent" @click="addField(f)">{{ FIELD_LABELS[f] }}</button></div>
        <p class="label mt-4">Ajouter</p>
        <div class="grid grid-cols-2 gap-1.5">
          <button class="btn btn-ghost !min-h-[40px] !rounded-lg text-xs" @click="addQr">QR code</button><button class="btn btn-ghost !min-h-[40px] !rounded-lg text-xs" @click="addText">Texte libre</button>
          <button class="btn btn-ghost !min-h-[40px] !rounded-lg text-xs" @click="addShape('rect')">Rectangle</button><button class="btn btn-ghost !min-h-[40px] !rounded-lg text-xs" @click="addShape('ellipse')">Ellipse</button>
          <button class="btn btn-ghost !min-h-[40px] col-span-2 !rounded-lg text-xs" :disabled="uploading" @click="logoIn?.click()">Logo / image (PNG, JPG)</button>
        </div>
        <input ref="logoIn" type="file" accept="image/png,image/jpeg" class="hidden" @change="onLogo">
        <p class="label mt-4">Modèle importé</p>
        <button class="btn btn-ghost !min-h-[40px] w-full !rounded-lg text-xs" :disabled="uploading" @click="fileIn?.click()">{{ uploading ? 'Envoi…' : 'Importer PNG / JPG / PDF' }}</button>
        <input ref="fileIn" type="file" accept="image/png,image/jpeg,application/pdf" class="hidden" @change="onBackground">
        <label class="mt-2 flex items-center gap-2 text-xs text-muted"><input v-model="fitFormat" type="checkbox" class="accent-[rgb(var(--c-a))]"> Adapter le format du billet au modèle</label>
        <button v-if="layout.background.assetId" class="mt-2 text-xs text-red-300 underline" @click="snapshot(); layout.background.assetId = null">Retirer l’image de fond</button>
        <label class="label mt-4" for="bgc">Couleur de fond</label><input id="bgc" v-model="layout.background.color" type="color" class="h-10 w-full rounded-lg border border-line bg-transparent" @focus="snapshot()">
        <label class="label mt-4" for="fmt">Format</label>
        <select id="fmt" class="input" :value="formatId" @change="setFormat(($event.target as HTMLSelectElement).value)"><option v-for="f in PRINT_FORMATS" :key="f.id" :value="f.id">{{ f.label }}</option><option value="custom" disabled>Personnalisé</option></select>
        <div class="mt-2 grid grid-cols-2 gap-2"><input v-model.number="layout.width" type="number" min="200" max="2400" class="input" aria-label="Largeur (px)" @focus="snapshot()"><input v-model.number="layout.height" type="number" min="120" max="2400" class="input" aria-label="Hauteur (px)" @focus="snapshot()"></div>
        <label class="label mt-4" for="thm">Appliquer un thème</label>
        <select id="thm" class="input" @change="applyTheme(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).selectedIndex = 0"><option value="">Choisir…</option><option v-for="t in THEMES" :key="t.id" :value="t.id">{{ t.name }}</option></select>
        <p class="label mt-4">Calques</p>
        <ul class="space-y-1"><li v-for="e in [...layout.elements].reverse()" :key="e.id" class="flex items-center gap-1"><button class="min-h-[36px] flex-1 truncate rounded-lg px-2 text-left text-xs" :class="sel === e.id ? 'bg-accent/20 text-accent' : 'hover:bg-line/50'" @click="sel = e.id">{{ label(e) }}</button><button class="min-h-[36px] w-9 rounded-lg text-xs hover:bg-line/50" :aria-label="e.hidden ? 'Afficher' : 'Masquer'" @click="snapshot(); e.hidden = !e.hidden">{{ e.hidden ? '◌' : '●' }}</button></li></ul>
      </aside>

      <!-- Scène -->
      <main ref="stageBox" class="order-1 min-h-[300px] overflow-auto bg-[radial-gradient(circle_at_50%_0%,rgb(var(--c-b)/.12),transparent_60%)] p-6 lg:order-2" tabindex="0" aria-label="Zone d’édition du billet" @pointerdown="sel = null">
        <div v-if="mode === 'edit'" class="mx-auto" :style="{ width: layout.width * zoom + 'px', height: layout.height * zoom + 'px' }">
          <div class="relative origin-top-left shadow-deep" :style="{ width: layout.width + 'px', height: layout.height + 'px', transform: `scale(${zoom})` }">
            <TicketRender :layout="layout" :ctx="SAMPLE_CONTEXT" :qr="qr" :assets="assets" />
            <div v-if="grid" class="pointer-events-none absolute inset-0 opacity-25" :style="{ backgroundImage: 'linear-gradient(to right, #fff3 1px, transparent 1px), linear-gradient(to bottom, #fff3 1px, transparent 1px)', backgroundSize: `${SNAP * 4}px ${SNAP * 4}px` }" />
            <div v-for="e in layout.elements" v-show="!e.hidden" :key="e.id" class="absolute touch-none" :class="sel === e.id ? 'outline outline-2 outline-[rgb(var(--c-a))]' : 'hover:outline hover:outline-1 hover:outline-[rgb(var(--c-a)/.6)]'" :style="{ left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px', cursor: 'move' }" @pointerdown.stop="startDrag($event, e)">
              <template v-if="sel === e.id"><i v-for="h in handles" :key="h" class="absolute block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-[rgb(var(--c-a))]" :style="hpos(h)" @pointerdown.stop="startDrag($event, e, h)" /></template>
            </div>
            <div v-for="(g, i) in guides" :key="i" class="pointer-events-none absolute bg-fuchsia-400" :style="g.axis === 'x' ? { left: g.pos + 'px', top: 0, bottom: 0, width: '1px' } : { top: g.pos + 'px', left: 0, right: 0, height: '1px' }" />
          </div>
        </div>
        <div v-else-if="mode === 'desktop'" class="mx-auto" :style="{ width: layout.width * Math.min(zoom, 1) + 'px', height: layout.height * Math.min(zoom, 1) + 'px' }"><div class="origin-top-left shadow-deep" :style="{ transform: `scale(${Math.min(zoom, 1)})`, width: layout.width + 'px' }"><TicketRender :layout="layout" :ctx="SAMPLE_CONTEXT" :qr="qr" :assets="assets" /></div></div>
        <div v-else class="mx-auto w-[300px] rounded-[2.4rem] border-[10px] border-neutral-800 bg-black p-3 shadow-deep"><div class="mb-3 mx-auto h-1.5 w-16 rounded-full bg-neutral-700" /><div :style="{ width: '276px', height: (layout.height * 276) / layout.width + 'px' }"><div class="origin-top-left" :style="{ width: layout.width + 'px', transform: `scale(${276 / layout.width})` }"><TicketRender :layout="layout" :ctx="SAMPLE_CONTEXT" :qr="qr" :assets="assets" /></div></div><p class="mt-4 pb-2 text-center text-xs text-neutral-400">Aperçu mobile (billet numérique)</p></div>
      </main>

      <!-- Propriétés -->
      <aside class="order-3 max-h-[40vh] overflow-y-auto border-line bg-surface/40 p-3 lg:max-h-none lg:border-l" aria-label="Propriétés">
        <div v-if="!el"><p class="font-display text-sm font-bold">Propriétés</p><p class="hint">Sélectionnez un élément sur le billet pour modifier sa position, sa taille, sa couleur…</p><p class="hint mt-3">Raccourcis : flèches (±1, Maj ±10), Suppr, Ctrl+Z / Y, Ctrl+D.</p></div>
        <div v-else class="space-y-3">
          <p class="font-display text-sm font-bold">{{ label(el) }}</p>
          <div class="grid grid-cols-4 gap-2">
            <label v-for="k in ['x', 'y', 'w', 'h']" :key="k" class="text-xs text-muted">{{ k.toUpperCase() }}<input v-model.number="el[k]" type="number" class="input !min-h-[38px] px-2" @focus="snapshot()"></label>
          </div>
          <div class="grid grid-cols-6 gap-1"><button v-for="a in [['l', '⇤'], ['c', '↔'], ['r', '⇥'], ['t', '⤒'], ['m', '↕'], ['b', '⤓']]" :key="a[0]" class="btn btn-ghost !min-h-[38px] !rounded-lg !px-0" :aria-label="`Aligner ${a[0]}`" @click="alignTo(a[0] as any)">{{ a[1] }}</button></div>
          <label class="block text-xs text-muted">Opacité {{ Math.round(el.opacity * 100) }}%<input v-model.number="el.opacity" type="range" min="0" max="1" step="0.05" class="w-full accent-[rgb(var(--c-a))]" @pointerdown="snapshot()"></label>
          <template v-if="el.type === 'text' || el.type === 'field'">
            <label v-if="el.type === 'text'" class="block text-xs text-muted">Texte<textarea v-model="el.text" rows="2" class="input !py-2" @focus="snapshot()" /></label>
            <label v-else class="block text-xs text-muted">Préfixe (facultatif)<input v-model="el.prefix" class="input" placeholder="ex. Lieu : " @focus="snapshot()"></label>
            <div class="grid grid-cols-2 gap-2"><label class="text-xs text-muted">Taille<input v-model.number="el.fontSize" type="number" min="6" max="200" class="input" @focus="snapshot()"></label><label class="text-xs text-muted">Police<select v-model="el.font" class="input" @focus="snapshot()"><option value="sans">Sans (Helvetica)</option><option value="serif">Serif (Times)</option><option value="mono">Mono (Courier)</option></select></label></div>
            <div class="flex items-center gap-2"><input v-model="el.color" type="color" class="h-10 w-12 rounded-lg border border-line bg-transparent" aria-label="Couleur du texte" @focus="snapshot()"><label class="flex min-h-[40px] items-center gap-2 text-sm"><input v-model="el.bold" type="checkbox" class="accent-[rgb(var(--c-a))]" @focus="snapshot()"> Gras</label>
              <div class="ml-auto flex overflow-hidden rounded-lg border border-line"><button v-for="a in ['left', 'center', 'right']" :key="a" class="min-h-[38px] w-9 text-xs" :class="el.align === a ? 'bg-accent text-[color:var(--on-accent,#05050a)]' : ''" :aria-label="`Aligner le texte ${a}`" @click="snapshot(); el.align = a">{{ a === 'left' ? 'G' : a === 'center' ? 'C' : 'D' }}</button></div></div>
          </template>
          <template v-if="el.type === 'shape'">
            <div class="grid grid-cols-2 gap-2"><label class="text-xs text-muted">Remplissage<input v-model="el.fill" type="color" class="h-10 w-full rounded-lg border border-line bg-transparent" @focus="snapshot()"></label><label class="text-xs text-muted">Bordure<input v-model="el.stroke" type="color" class="h-10 w-full rounded-lg border border-line bg-transparent" @focus="snapshot()"></label></div>
            <div class="grid grid-cols-2 gap-2"><label class="text-xs text-muted">Épaisseur<input v-model.number="el.strokeWidth" type="number" min="0" max="40" class="input" @focus="snapshot()"></label><label v-if="el.shape === 'rect'" class="text-xs text-muted">Arrondi<input v-model.number="el.radius" type="number" min="0" max="200" class="input" @focus="snapshot()"></label></div>
          </template>
          <template v-if="el.type === 'qr'">
            <div class="grid grid-cols-2 gap-2"><label class="text-xs text-muted">Modules<input v-model="el.fg" type="color" class="h-10 w-full rounded-lg border border-line bg-transparent" @focus="snapshot()"></label><label class="text-xs text-muted">Fond<input v-model="el.bg" type="color" class="h-10 w-full rounded-lg border border-line bg-transparent" @focus="snapshot()"></label></div>
            <label class="flex min-h-[40px] items-center gap-2 text-sm"><input v-model="el.quiet" type="checkbox" class="accent-[rgb(var(--c-a))]" @focus="snapshot()"> Marge de silence</label>
            <p class="text-xs" :class="contrastRatio(el.fg, el.bg) >= 4 ? 'text-emerald-400' : 'text-red-400'">Contraste {{ contrastRatio(el.fg, el.bg).toFixed(1) }}:1 — {{ contrastRatio(el.fg, el.bg) >= 4 ? 'lisible' : 'insuffisant (4:1 requis)' }}</p>
          </template>
          <label v-if="el.type === 'image'" class="block text-xs text-muted">Ajustement<select v-model="el.fit" class="input" @focus="snapshot()"><option value="contain">Contenir</option><option value="cover">Remplir</option></select></label>
          <div class="grid grid-cols-2 gap-1.5"><button class="btn btn-ghost !min-h-[38px] !rounded-lg text-xs" @click="order('front')">Premier plan</button><button class="btn btn-ghost !min-h-[38px] !rounded-lg text-xs" @click="order('back')">Arrière-plan</button><button class="btn btn-ghost !min-h-[38px] !rounded-lg text-xs" @click="order('up')">Monter</button><button class="btn btn-ghost !min-h-[38px] !rounded-lg text-xs" @click="order('down')">Descendre</button><button class="btn btn-ghost !min-h-[38px] !rounded-lg text-xs" @click="dup">Dupliquer</button><button class="btn btn-danger !min-h-[38px] !rounded-lg text-xs" @click="del">Supprimer</button></div>
        </div>
      </aside>
    </div>

    <!-- Choix de la page PDF -->
    <div v-if="pdf.open" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Choisir la page du PDF">
      <div class="card w-full max-w-lg space-y-4 p-5">
        <p class="font-display text-lg font-bold">PDF de {{ pdf.pages }} page{{ pdf.pages > 1 ? 's' : '' }} : quelle page utiliser ?</p>
        <canvas ref="pdfCanvas" class="mx-auto max-h-72 max-w-full rounded-lg border border-line bg-white" />
        <label v-if="pdf.pages > 1" class="block text-sm">Page <input v-model.number="pdf.page" type="number" min="1" :max="pdf.pages" class="input ml-2 !w-24 inline-block"> / {{ pdf.pages }}</label>
        <div class="flex justify-end gap-2"><button class="btn btn-ghost" @click="pdf.open = false">Annuler</button><button class="btn btn-primary" :disabled="uploading" @click="usePdfPage">Utiliser cette page</button></div>
      </div>
    </div>
    <div v-if="qrTest.open" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Test du QR code">
      <div class="card w-full max-w-sm space-y-3 p-5 text-center"><p class="font-display text-lg font-bold">Test du QR code</p><img :src="qrTest.url" alt="QR de test" class="mx-auto h-48 w-48 rounded-lg"><p v-if="qrTest.ok === null" class="text-sm text-muted">Décodage…</p><p v-else :class="qrTest.ok ? 'text-emerald-400' : 'text-red-400'" class="font-semibold">{{ qrTest.ok ? 'Lisible : décodé avec succès' : 'Illisible : augmentez le contraste ou la taille' }}</p><p class="text-xs text-muted">Contraste {{ qrTest.ratio.toFixed(1) }}:1. Scannez aussi avec un téléphone pour valider sur votre fond.</p><button class="btn btn-primary w-full" @click="qrTest.open = false">Fermer</button></div>
    </div>
  </div>
</template>
