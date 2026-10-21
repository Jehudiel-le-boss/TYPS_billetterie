<script setup lang="ts">
import { CircleHelp, ChevronLeft, ChevronRight, X } from '@lucide/vue'

type GuideRole = 'attend' | 'organize' | 'agent'
interface GuideStep { eyebrow: string; title: string; body: string; target?: string }

const route = useRoute()
const router = useRouter()
const me = useMe()
const menuOpen = ref(false)
const active = ref(false)
const steps = ref<GuideStep[]>([])
const stepIndex = ref(0)
const targetRect = ref<DOMRect | null>(null)
const card = ref<HTMLElement | null>(null)
const helpButton = ref<HTMLButtonElement | null>(null)
const { visible: guideVisible, load: loadGuideVisibility } = useGuideVisibility()
let resizeObserver: ResizeObserver | null = null
let startedWelcome = false
let targetUpdateId = 0
let activeRole: GuideRole = 'attend'

const roleNames: Record<GuideRole, string> = { attend: 'Acheteur', organize: 'Organisateur', agent: 'Agent' }
const currentStep = computed(() => steps.value[stepIndex.value])
const isPersonalSpace = computed(() => ['/app', '/admin', '/scan'].some((prefix) => route.path === prefix || route.path.startsWith(`${prefix}/`)))
const showFloatingButton = computed(() => !isPersonalSpace.value || guideVisible.value)
watch(showFloatingButton, (visible) => { if (!visible) menuOpen.value = false })
const currentRole = computed<GuideRole>(() => {
  const saved = import.meta.client && me.value.user?.id ? localStorage.getItem(`typs-guide-intent:${me.value.user.id}`) : null
  return saved === 'organize' || saved === 'agent' ? saved : 'attend'
})
const isLast = computed(() => stepIndex.value === steps.value.length - 1)
const cardStyle = computed(() => {
  const r = targetRect.value
  if (!r) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  const width = Math.min(390, window.innerWidth - 32)
  const left = Math.min(Math.max(16, r.left + r.width / 2 - width / 2), window.innerWidth - width - 16)
  const height = card.value?.offsetHeight ?? 300
  const top = Math.min(r.bottom + 16, Math.max(16, window.innerHeight - height - 16))
  return { top: `${top}px`, left: `${left}px`, width: `${width}px` }
})
const spotlightStyle = computed(() => targetRect.value ? {
  top: `${targetRect.value.top - 6}px`,
  left: `${targetRect.value.left - 6}px`,
  width: `${targetRect.value.width + 12}px`,
  height: `${targetRect.value.height + 12}px`
} : null)

const discoverySteps: GuideStep[] = [
  { eyebrow: 'Bienvenue sur TYPS', title: 'La billetterie, simplement.', body: 'Un petit tour pour repérer les principales actions. Tu peux le passer à tout moment et continuer à utiliser le site.' },
  { eyebrow: 'Découvrir', title: 'Trouve ton prochain événement.', body: 'Explore les événements, compare les dates, les lieux et les tarifs. Tu peux acheter sans créer de compte.', target: '[data-guide="header-explore"], [data-guide="home-explore"]' },
  { eyebrow: 'Acheter', title: 'Ton billet reste facile à retrouver.', body: 'Après le paiement confirmé, le billet et son QR sont accessibles depuis le lien sécurisé de commande. Avec un compte vérifié utilisant la même adresse, retrouve aussi tes achats dans « Mes achats ».', target: '[data-guide="home-buyer"]' },
  { eyebrow: 'Organiser', title: 'Lance ta billetterie.', body: 'Crée une organisation, prépare un événement, ses catégories et ses billets. Tu gardes le contrôle avant de publier.', target: '[data-guide="home-organizer"]' },
  { eyebrow: 'Les rôles', title: 'Un compte peut avoir plusieurs usages.', body: 'Acheteur : achète et retrouve ses billets. Propriétaire/gestionnaire : administre une organisation et ses événements. Vendeur : ventes au guichet. Agent : contrôle les billets après invitation. Lecture seule : consulte les informations autorisées. Les permissions dépendent des rôles d’équipe; le choix à l’inscription ne donne aucun droit. Admin TYPS est un rôle global attribué séparément.', target: '[data-guide="roles-section"]' },
  { eyebrow: 'Prêt à commencer ?', title: 'Tu choisis ton parcours.', body: 'Les rôles peuvent se cumuler selon les organisations et les événements. Le bouton « Aide » reste disponible pour revoir ce guide ou un parcours précis.', target: '[data-guide="home-explore"]' }
]

const roleSteps: Record<GuideRole, GuideStep[]> = {
  attend: [
    { eyebrow: 'Ton parcours acheteur', title: 'Explore librement.', body: 'Parcours les événements sans compte. Le prix total est présenté avant le paiement.', target: '[data-guide="buyer-explore"], [data-guide="header-explore"], [data-guide="home-explore"]' },
    { eyebrow: 'Après le paiement', title: 'Retrouve ton billet.', body: 'Le lien sécurisé reçu à la confirmation permet de revoir et télécharger les billets, même sans compte. Ne le partage pas.', target: '[data-guide="nav-buyer-orders"], [data-guide="header-account"]' },
    { eyebrow: 'Ton espace acheteur', title: 'Centralise tes commandes.', body: 'Crée ou utilise un compte avec la même adresse e-mail vérifiée que celle de tes achats, puis ouvre « Mes achats » depuis « Mon espace » pour retrouver les commandes et billets.', target: '[data-guide="buyer-history"], [data-guide="nav-buyer-orders"], [data-guide="header-account"]' }
  ],
  organize: [
    { eyebrow: 'Ton parcours organisateur', title: 'Commence par ton organisation.', body: 'Elle représente l’équipe qui crée et gère les événements. Le créateur en devient propriétaire; une organisation peut ensuite inviter ses membres.', target: '[data-guide="organizer-create-org"], [data-guide="organizer-create-event"]' },
    { eyebrow: 'Prépare ta billetterie', title: 'Crée un événement puis ses billets.', body: 'Ajoute les informations, dates et lieu. Ensuite, configure les catégories, prix et quotas; vérifie l’aperçu et publie quand tout est prêt.', target: '[data-guide="organizer-create-event"]' },
    { eyebrow: 'Travaille en équipe', title: 'Attribue uniquement les droits nécessaires.', body: 'Propriétaire et gestionnaire administrent l’événement. Vendeur vend au guichet; agent contrôle les accès; lecture seule consulte les données permises. Ces rôles se règlent dans l’équipe et les permissions sont vérifiées côté serveur.', target: '[data-guide="organizer-team"], [data-guide="nav-team"]' }
  ],
  agent: [
    { eyebrow: 'Ton parcours agent', title: 'Les accès sont donnés par l’organisateur.', body: 'Choisir « Agent » ne confère pas automatiquement de droits. Demande à l’organisateur de t’inviter avec l’adresse de ton compte et de t’affecter à l’événement voulu.', target: '[data-guide="agent-invitation"]' },
    { eyebrow: 'Contrôle des entrées', title: 'Ouvre uniquement un événement attribué.', body: 'Les événements disponibles dans cette liste sont ceux auxquels tu as accès. Le scan indique si le billet est valide, déjà utilisé ou refusé.', target: '[data-guide="agent-events"], [data-guide="agent-invitation"]' },
    { eyebrow: 'Tes permissions', title: 'Un accès limité, événement par événement.', body: 'Un agent peut scanner; un vendeur peut aussi être autorisé à créer des ventes au guichet. Seul l’organisateur décide et peut retirer ces droits.', target: '[data-guide="agent-invitation"]' }
  ]
}

function fullSteps(role: GuideRole): GuideStep[] {
  return [...discoverySteps, ...roleSteps[role]]
}

function isPublicPath(path: string) {
  return !['/auth', '/app', '/admin', '/scan', '/orders', '/transfer'].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function resolveTarget(selector?: string) {
  if (!selector) return null
  for (const part of selector.split(',').map((item) => item.trim())) {
    const element = document.querySelector<HTMLElement>(part)
    if (element && element.getClientRects().length) return element
  }
  return null
}

async function waitForTargetToSettle(element: HTMLElement) {
  let previous: number[] | null = null
  let stableFrames = 0
  const deadline = performance.now() + 2200

  while (stableFrames < 8 && performance.now() < deadline) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const rect = element.getBoundingClientRect()
    const current = [window.scrollX, window.scrollY, rect.left, rect.top, rect.width, rect.height]
    stableFrames = previous && current.every((value, index) => Math.abs(value - previous![index]) < 0.5)
      ? stableFrames + 1
      : 0
    previous = current
  }
}

async function updateTarget() {
  const updateId = ++targetUpdateId
  await nextTick()
  const element = resolveTarget(currentStep.value?.target)
  if (!element) {
    targetRect.value = null
    return
  }
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  await waitForTargetToSettle(element)
  if (updateId !== targetUpdateId) return
  const rect = element.getBoundingClientRect()
  targetRect.value = rect
  await nextTick()
  const updated = element.getBoundingClientRect()
  targetRect.value = updated
  await nextTick()
  card.value?.focus()
}

function finish() {
  targetUpdateId++
  const userId = me.value.user?.id ?? 'guest'
  localStorage.setItem('typs-guide-discovery-v1', 'seen')
  localStorage.setItem(`typs-guide-role:${userId}:${activeRole}`, 'seen')
  active.value = false
  menuOpen.value = false
  targetRect.value = null
  resizeObserver?.disconnect()
  resizeObserver = null
  nextTick(() => helpButton.value?.focus())
}

async function start(kind: 'discovery' | 'role' | 'full', role = currentRole.value, persistRole = false) {
  menuOpen.value = false
  startedWelcome = true
  activeRole = role
  steps.value = kind === 'discovery' ? discoverySteps : kind === 'role' ? roleSteps[role] : fullSteps(role)
  stepIndex.value = 0
  active.value = true
  if (persistRole && me.value.user?.id) localStorage.setItem(`typs-guide-intent:${me.value.user.id}`, role)
  await updateTarget()
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => { void updateTarget() })
  resizeObserver.observe(document.documentElement)
}

async function next() {
  if (isLast.value) return finish()
  stepIndex.value++
  await updateTarget()
}

async function previous() {
  if (stepIndex.value === 0) return
  stepIndex.value--
  await updateTarget()
}

function onKeydown(event: KeyboardEvent) {
  if (!active.value) return
  if (event.key === 'Escape') { event.preventDefault(); finish() }
  if (event.key === 'ArrowRight') { event.preventDefault(); void next() }
  if (event.key === 'ArrowLeft') { event.preventDefault(); void previous() }
  if (event.key === 'Tab' && card.value) {
    const focusable = [...card.value.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
    if (!focusable.length) { event.preventDefault(); card.value.focus(); return }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
}

async function cleanWelcomeQuery() {
  const query = { ...route.query }
  delete query.typsWelcome
  await router.replace({ path: route.path, query, hash: route.hash })
}

watch([() => route.query.typsWelcome, () => me.value.user?.id], async ([value, userId]) => {
  const role = String(value ?? '')
  if ((role !== 'attend' && role !== 'organize' && role !== 'agent') || !userId) return
  if (!import.meta.client) return
  const key = `typs-guide-role:${userId}:${role}`
  if (localStorage.getItem(key) !== 'seen') {
    await start('role', role, true)
    localStorage.setItem(key, 'seen')
  }
  await cleanWelcomeQuery()
}, { flush: 'post' })
watch(() => me.value.user?.id, loadGuideVisibility)

onMounted(() => {
  loadGuideVisibility()
  window.addEventListener('keydown', onKeydown)
  if (!startedWelcome && isPublicPath(route.path) && localStorage.getItem('typs-guide-discovery-v1') !== 'seen') {
    window.setTimeout(() => { if (!startedWelcome) void start('discovery') }, 700)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[70] sm:bottom-6 sm:right-6">
    <div v-if="menuOpen" class="mb-3 max-h-[min(70vh,36rem)] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-2xl" aria-label="Aide TYPS">
      <div class="flex items-start justify-between gap-3 px-2 pb-2">
        <div><p class="text-sm font-bold">Centre d’aide</p><p class="text-xs text-muted">Guides courts, à revoir quand tu veux.</p></div>
        <button type="button" class="rounded-lg p-1 text-muted hover:text-fg" aria-label="Fermer l’aide" @click="menuOpen = false"><X :size="18" /></button>
      </div>
      <div class="space-y-1">
        <button type="button" class="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-line/40" @click="start('full')">Rejouer toute l’aide <span class="mt-0.5 block text-xs font-normal text-muted">Découverte + rôles + ton parcours</span></button>
        <div class="my-2 border-t border-line" />
        <button type="button" class="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-line/40" @click="start('discovery')">Découvrir TYPS</button>
        <button v-for="role in (['attend', 'organize', 'agent'] as GuideRole[])" :key="role" type="button" class="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-line/40" @click="start('role', role)">{{ roleNames[role] }} <span v-if="role === currentRole" class="text-xs text-accent">· mon parcours</span></button>
      </div>
    </div>
    <button v-if="showFloatingButton" ref="helpButton" type="button" class="grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-accent shadow-xl transition hover:-translate-y-0.5 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent" aria-label="Ouvrir le centre d’aide et rejouer les guides" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
      <CircleHelp :size="22" />
    </button>
  </div>

  <Teleport to="body">
    <div v-if="active && currentStep" class="fixed inset-0 z-[100]" aria-live="polite">
      <div class="absolute inset-0" :class="targetRect ? '' : 'bg-black/65'" />
      <div v-if="spotlightStyle" class="pointer-events-none fixed rounded-2xl border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.65),0_0_30px_rgba(34,211,238,0.5)] transition-all duration-300" :style="spotlightStyle" />
      <section ref="card" tabindex="-1" class="fixed z-[102] max-h-[min(70vh,34rem)] overflow-y-auto rounded-2xl border border-accent/40 bg-surface p-5 shadow-2xl sm:p-6" :style="cardStyle" role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-body">
        <div class="mb-4 flex items-center justify-between gap-3">
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-accent">{{ currentStep.eyebrow }}</p>
          <div class="flex items-center gap-3"><span class="text-xs tabular-nums text-muted">{{ stepIndex + 1 }} / {{ steps.length }}</span><button type="button" class="rounded-lg p-1 text-muted hover:text-fg" aria-label="Fermer le guide" @click="finish"><X :size="18" /></button></div>
        </div>
        <div class="mb-5 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" :aria-valuenow="stepIndex + 1" :aria-valuemin="1" :aria-valuemax="steps.length" :aria-label="`Étape ${stepIndex + 1} sur ${steps.length}`"><div class="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-all" :style="{ width: `${((stepIndex + 1) / steps.length) * 100}%` }" /></div>
        <h2 id="guide-title" class="font-display text-xl font-bold sm:text-2xl">{{ currentStep.title }}</h2>
        <p id="guide-body" class="mt-3 text-sm leading-relaxed text-muted sm:text-base">{{ currentStep.body }}</p>
        <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" class="text-sm text-muted underline-offset-4 hover:text-fg hover:underline" @click="finish">Passer</button>
          <div class="ml-auto flex gap-2">
            <button v-if="stepIndex > 0" type="button" class="btn btn-ghost !min-h-[42px] px-3" @click="previous"><ChevronLeft :size="17" />Précédent</button>
            <button type="button" class="btn btn-primary !min-h-[42px] px-4" @click="next">{{ isLast ? 'Terminer' : 'Suivant' }}<ChevronRight v-if="!isLast" :size="17" /></button>
          </div>
        </div>
        <p class="mt-4 text-[11px] text-muted">Échap pour fermer · ← → pour naviguer</p>
      </section>
    </div>
  </Teleport>
</template>
