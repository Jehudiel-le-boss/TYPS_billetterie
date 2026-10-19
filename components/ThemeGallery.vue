<script setup lang="ts">
// Galerie de thèmes avec aperçu en direct + créateur de thème personnalisé (couleurs, fond, typographie, bordures).
import { FONT_STACKS, type Theme } from '~~/shared/themes'
const props = defineProps<{ modelValue?: string; scope?: 'global' | 'local' }>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()
const { id, all, set, saveCustom, find } = useTheme()
const active = computed(() => (props.scope === 'local' ? props.modelValue ?? id.value : id.value))
const pick = (t: Theme) => { if (props.scope === 'local') emit('update:modelValue', t.id); else set(t.id) }
const builder = reactive({ open: false, name: 'Mon thème', bg: '#0b0f1a', surface: '#141a2b', fg: '#f4f6fb', muted: '#9aa4bd', a: '#7cf0c8', b: '#6d7bff', line: '#27304a', radius: 18, font: 'sans' as Theme['font'], mode: 'dark' as Theme['mode'] })
const { ok } = useToast()
function save() { const t: Theme = { id: `custom-${Date.now().toString(36)}`, blurb: 'Thème personnalisé', ...builder }; saveCustom(t); if (props.scope === 'local') emit('update:modelValue', t.id); ok('Thème enregistré sur cet appareil') }
const colorFields: [keyof typeof builder, string][] = [['bg', 'Arrière-plan'], ['surface', 'Surfaces'], ['fg', 'Texte'], ['a', 'Accent 1'], ['b', 'Accent 2'], ['line', 'Bordures']]
const preview = computed(() => ({ ...cssVars({ ...builder, id: 'p', blurb: '' } as Theme) }))
void find
</script>
<template>
  <div>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4" role="listbox" aria-label="Galerie de thèmes">
      <button v-for="t in all" :key="t.id" role="option" :aria-selected="active === t.id" class="group relative overflow-hidden rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 focus-visible:outline-offset-2" :class="active === t.id ? 'border-accent ring-2 ring-accent/40' : 'border-line'" :style="{ background: t.bg, color: t.fg, borderRadius: Math.min(t.radius, 22) + 'px' }" @click="pick(t)">
        <span class="mb-3 block h-10 rounded-lg" :style="{ background: `linear-gradient(120deg, ${t.a}, ${t.b})`, borderRadius: Math.min(t.radius, 14) + 'px' }" />
        <span class="block truncate text-sm font-bold" :style="{ fontFamily: FONT_STACKS[t.font] }">{{ t.name }}</span>
        <span class="mt-0.5 line-clamp-2 block text-[0.7rem] leading-snug" :style="{ color: t.muted }">{{ t.blurb }}</span>
        <span v-if="active === t.id" class="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[0.65rem] font-bold" :style="{ background: t.a, color: t.bg }">Actif</span>
      </button>
    </div>
    <div class="mt-6">
      <button class="btn btn-ghost" :aria-expanded="builder.open" @click="builder.open = !builder.open">{{ builder.open ? 'Fermer le créateur' : 'Créer mon thème' }}</button>
      <div v-if="builder.open" class="card mt-4 grid gap-6 p-5 lg:grid-cols-2">
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block sm:col-span-2"><span class="label">Nom</span><input v-model="builder.name" class="input" maxlength="40"></label>
          <label v-for="f in colorFields" :key="f[0]" class="block"><span class="label">{{ f[1] }}</span><input v-model="(builder as any)[f[0]]" type="color" class="h-11 w-full cursor-pointer rounded-xl border border-line bg-transparent"></label>
          <label class="block"><span class="label">Typographie</span><select v-model="builder.font" class="input"><option value="sans">Sans moderne</option><option value="display">Display large</option><option value="serif">Serif élégante</option><option value="mono">Mono rétro</option></select></label>
          <label class="block"><span class="label">Bordures arrondies : {{ builder.radius }}px</span><input v-model.number="builder.radius" type="range" min="0" max="32" class="w-full accent-[rgb(var(--c-a))]"></label>
          <label class="block"><span class="label">Mode</span><select v-model="builder.mode" class="input"><option value="dark">Sombre</option><option value="light">Clair</option></select></label>
          <button class="btn btn-primary sm:col-span-2" @click="save">Enregistrer et appliquer</button>
        </div>
        <div class="grid place-items-center rounded-2xl p-6" :style="{ ...preview, background: builder.bg }"><div class="w-full max-w-sm"><TicketFace /></div></div>
      </div>
    </div>
  </div>
</template>
