<script setup lang="ts">
import { QrCode, ScanLine, ShieldCheck, Smartphone, Palette, Wallet, Users, BarChart3, Share2, Sparkles, Zap, Globe2 } from '@lucide/vue'
const { current } = useTheme(); const reduced = useReducedMotion()
const use3d = ref(false); const Ticket3D = defineAsyncComponent(() => import('~/components/Ticket3D.vue'))
onMounted(() => { try { const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'); use3d.value = !!gl && !reduced.value && window.innerWidth >= 768 && (navigator.hardwareConcurrency ?? 4) >= 4 } catch { use3d.value = false } })
const { data: events } = await useAsyncData('home-events', async () => { try { return (await api<any>('/api/events?page=1')).items.slice(0, 3) } catch { return [] } })
useSeoMeta({ title: 'Billetterie événementielle personnalisable', ogTitle: 'TYPS — Ton événement. Ton ticket. Ton contrôle.', ogDescription: 'Crée tes billets, vends tes entrées en FCFA et contrôle les accès par QR code.', twitterCard: 'summary_large_image' })
const benefits = [
  { icon: Zap, t: 'Vendre en quelques minutes', d: 'Crée l’événement, ajoute tes catégories (gratuit, standard, VIP, early bird…) et partage ton lien. Le paiement passe par FedaPay.' },
  { icon: ShieldCheck, t: 'Billets infalsifiables', d: 'Chaque QR code est unique, signé et vérifié par le serveur. Aucune donnée personnelle n’y figure, et un billet ne rentre qu’une fois.' },
  { icon: ScanLine, t: 'Contrôle en direct', d: 'Un navigateur suffit : vert, orange ou rouge en une seconde, compteur d’entrées, plusieurs portes et mode hors ligne encadré.' }
]
const steps = [{ n: '01', t: 'Crée', d: 'Titre, date, lieu, catégories de billets et quotas. Brouillon enregistré automatiquement.' }, { n: '02', t: 'Personnalise', d: 'Importe ton visuel (PNG, JPG, PDF) et place le nom, le QR, le lieu… où tu veux.' }, { n: '03', t: 'Vends et contrôle', d: 'Ventes en ligne et au guichet, puis scanner à l’entrée avec n’importe quel téléphone.' }]
const features = [
  { icon: Palette, t: 'Studio de billets', d: 'Éditeur visuel : glisser-déposer, calques, grille magnétique, annuler/rétablir.' }, { icon: QrCode, t: 'QR haute résolution', d: 'Export PDF individuel, planche d’impression A4 et archive ZIP.' },
  { icon: Wallet, t: 'Ventes au guichet', d: 'Encaisse en espèces et imprime le billet sur place, sans double attribution.' }, { icon: Users, t: 'Équipe et agents', d: 'Affecte des agents à un événement, révoque leur accès en un clic.' },
  { icon: BarChart3, t: 'Statistiques réelles', d: 'Ventes, recettes, conversion, entrées : calculées depuis ta base, jamais inventées.' }, { icon: Share2, t: 'Promotion intégrée', d: 'Lien de partage, QR public, codes promo, liens de campagne.' },
  { icon: Sparkles, t: 'Invités et listes VIP', d: 'Importe un CSV avec aperçu des erreurs, émets des invitations gratuites.' }, { icon: Globe2, t: 'Pensé pour l’Afrique francophone', d: 'FCFA/XOF, mobile money via FedaPay, interface en français.' }
]
const faq = [
  ['Combien coûte TYPS ?', 'Les commissions sont configurables par la plateforme et affichées clairement avant le paiement : tu vois toujours ce que paie l’acheteur et ce que tu perçois.'],
  ['Comment sont versées mes recettes ?', 'Les paiements en ligne sont encaissés via FedaPay. Les reversements aux organisateurs sont suivis dans TYPS (rapprochement) et effectués selon les modalités du compte marchand ; un mode manuel contrôlé est prévu.'],
  ['Un billet peut-il être copié ?', 'Le QR code peut être photographié, mais le serveur n’accepte une entrée qu’une seule fois : le second scan est refusé en orange.'],
  ['Et sans internet à l’entrée ?', 'Un mode hors ligne limité existe (si tu l’actives) : les appareils vérifient un pack téléchargé puis synchronisent. Deux appareils déconnectés ne peuvent pas se voir en temps réel : les doublons sont signalés à la reconnexion.'],
  ['Puis-je vendre sans internet pour les clients ?', 'Oui : la vente au guichet enregistre les paiements espèces et génère le billet immédiatement.']
]
</script>
<template>
  <div>
    <!-- Hero -->
    <section class="relative isolate overflow-hidden">
      <ParticleField :intensity="0.7" />
      <div class="pointer-events-none absolute -left-40 top-0 h-[34rem] w-[34rem] rounded-full bg-accent2/25 blur-[120px]" /><div class="pointer-events-none absolute -right-32 top-40 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-[120px]" />
      <div class="container-x relative grid items-center gap-8 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div>
          <Reveal><span class="chip"><span class="h-2 w-2 animate-pulse rounded-full bg-accent" />Billetterie événementielle · Bénin &amp; Afrique francophone</span></Reveal>
          <Reveal :delay="0.08"><h1 class="mt-6 text-[clamp(2.4rem,6.4vw,4.6rem)] font-black">Ton événement.<br>Ton ticket.<br>Ton contrôle.</h1></Reveal>
          <Reveal :delay="0.16"><p class="mt-6 max-w-xl text-lg text-muted">Crée des billets à ton image, vends tes entrées en FCFA et contrôle les accès avec un simple téléphone. Du premier événement à la grande soirée, sans paperasse.</p></Reveal>
          <Reveal :delay="0.24"><div class="mt-8 flex flex-wrap gap-3"><NuxtLink to="/auth/register" class="btn btn-primary !min-h-[52px] px-7 text-base">Créer mon premier événement</NuxtLink><NuxtLink to="/events" class="btn btn-ghost !min-h-[52px] px-7 text-base">Explorer les événements</NuxtLink></div></Reveal>
          <Reveal :delay="0.32"><ul class="mt-8 flex flex-wrap gap-2 text-sm text-muted"><li class="chip">Paiement FedaPay</li><li class="chip">PDF + QR signé</li><li class="chip">Scanner dans le navigateur</li><li class="chip">FCFA / XOF</li></ul></Reveal>
        </div>
        <div class="relative mx-auto aspect-[5/4] w-full max-w-2xl">
          <ClientOnly><Ticket3D v-if="use3d" :title="'Lagune Live'" name="Aïcha Dossou" :a="current.a" :b="current.b" :bg="current.bg" :fg="current.fg" /><template #fallback><div class="grid h-full place-items-center"><TicketFace class="floaty" /></div></template></ClientOnly>
          <div v-if="!use3d" class="absolute inset-0 grid place-items-center"><TicketFace tilt class="floaty max-w-lg" /></div>
        </div>
      </div>
    </section>

    <div class="overflow-hidden border-y border-line/60 bg-surface/30 py-4" aria-hidden="true"><div class="marquee flex w-max gap-10 whitespace-nowrap font-display text-sm font-bold uppercase tracking-[0.25em] text-muted"><span v-for="n in 2" :key="n" class="flex gap-10"><span>Billets personnalisés</span><span class="text-accent">✦</span><span>QR signés</span><span class="text-accent">✦</span><span>Ventes au guichet</span><span class="text-accent">✦</span><span>Scanner anti-fraude</span><span class="text-accent">✦</span><span>16 thèmes</span><span class="text-accent">✦</span><span>Studio visuel</span><span class="text-accent">✦</span></span></div></div>

    <!-- Bénéfices -->
    <section class="container-x py-24"><Reveal><h2 class="max-w-2xl text-[clamp(1.8rem,4vw,3rem)] font-black">Tout ce qu’il faut pour une porte qui s’ouvre sans accroc</h2></Reveal>
      <div class="mt-12 grid gap-5 md:grid-cols-3"><Reveal v-for="(b, i) in benefits" :key="b.t" :delay="i * 0.1"><article class="card h-full p-6 transition hover:-translate-y-1 hover:shadow-glow"><span class="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent2 text-[color:var(--on-accent,#05050a)]"><component :is="b.icon" :size="24" /></span><h3 class="mt-5 text-xl font-bold">{{ b.t }}</h3><p class="mt-2 text-muted">{{ b.d }}</p></article></Reveal></div></section>

    <!-- Personnalisation -->
    <section id="themes" class="relative scroll-mt-20 py-24"><div class="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-accent2/5 to-transparent" />
      <div class="container-x"><div class="grid items-start gap-10 lg:grid-cols-[1fr_1.1fr]"><div class="lg:sticky lg:top-24"><Reveal><span class="chip">Personnalisation en direct</span><h2 class="mt-4 text-[clamp(1.8rem,4vw,3rem)] font-black">16 thèmes, et le tien</h2><p class="mt-4 text-muted">Choisis un thème : tout le site et ce billet changent instantanément. Chaque événement garde son identité, de la page de vente au billet final.</p></Reveal>
        <div class="mt-8"><TicketFace tilt title="Nuit Afro Vibes" name="Koffi Mensah" category="VIP" /></div></div>
        <Reveal><ThemeGallery /></Reveal></div></div></section>

    <!-- Étapes -->
    <section class="container-x py-24"><Reveal><h2 class="text-[clamp(1.8rem,4vw,3rem)] font-black">En trois étapes</h2></Reveal>
      <ol class="mt-12 grid gap-5 md:grid-cols-3"><Reveal v-for="(s, i) in steps" :key="s.n" :delay="i * 0.1" as="li"><div class="card relative h-full overflow-hidden p-6"><span class="font-display text-7xl font-black text-line">{{ s.n }}</span><h3 class="mt-2 text-2xl font-bold">{{ s.t }}</h3><p class="mt-2 text-muted">{{ s.d }}</p></div></Reveal></ol></section>

    <!-- Scanner -->
    <section id="scanner" class="container-x scroll-mt-20 py-24"><div class="grid items-center gap-12 lg:grid-cols-2">
      <Reveal><div class="relative mx-auto w-[290px] rounded-[2.6rem] border-[10px] border-neutral-800 bg-black p-3 shadow-deep"><div class="mx-auto mb-3 h-1.5 w-16 rounded-full bg-neutral-700" />
        <div class="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-3xl bg-neutral-900"><div class="relative h-44 w-44 rounded-3xl border-2 border-white/80"><span class="scan-line absolute inset-x-2 h-0.5 rounded bg-accent shadow-[0_0_14px_rgb(var(--c-a))]" /></div></div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-[0.7rem] font-bold text-white"><span class="rounded-xl bg-emerald-700 py-2.5">Valide</span><span class="rounded-xl bg-orange-700 py-2.5">Déjà utilisé</span><span class="rounded-xl bg-red-700 py-2.5">Refusé</span></div></div></Reveal>
      <Reveal :delay="0.1"><span class="chip">Scanner</span><h2 class="mt-4 text-[clamp(1.8rem,4vw,3rem)] font-black">Un téléphone, trois couleurs</h2><p class="mt-4 text-muted">Vert : entrée acceptée. Orange : billet déjà utilisé. Rouge : invalide, annulé ou pour un autre événement. La décision est prise par le serveur, de façon atomique : si deux agents scannent le même billet au même instant, un seul entre.</p>
        <ul class="mt-6 space-y-3 text-sm"><li class="flex gap-3"><Smartphone :size="20" class="mt-0.5 shrink-0 text-accent" />Caméra, saisie manuelle et recherche par nom</li><li class="flex gap-3"><Users :size="20" class="mt-0.5 shrink-0 text-accent" />Agents affectés par événement, révocation immédiate</li><li class="flex gap-3"><ShieldCheck :size="20" class="mt-0.5 shrink-0 text-accent" />Mode hors ligne limité, avec limites expliquées</li></ul>
        <NuxtLink to="/scan" class="btn btn-ghost mt-8">Ouvrir le scanner</NuxtLink></Reveal></div></section>

    <!-- Fonctionnalités -->
    <section class="container-x py-24"><Reveal><h2 class="max-w-2xl text-[clamp(1.8rem,4vw,3rem)] font-black">Pensé pour les organisateurs</h2></Reveal>
      <div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Reveal v-for="(f, i) in features" :key="f.t" :delay="(i % 4) * 0.07"><article class="card h-full p-5"><component :is="f.icon" :size="22" class="text-accent" /><h3 class="mt-3 text-base font-bold">{{ f.t }}</h3><p class="mt-1.5 text-sm text-muted">{{ f.d }}</p></article></Reveal></div></section>

    <!-- Événements -->
    <section class="container-x py-24"><div class="flex flex-wrap items-end justify-between gap-4"><Reveal><h2 class="text-[clamp(1.8rem,4vw,3rem)] font-black">À découvrir</h2></Reveal><NuxtLink to="/events" class="btn btn-ghost">Tous les événements</NuxtLink></div>
      <div v-if="events?.length" class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"><EventCard v-for="e in events" :key="e.id" :e="e" /></div>
      <div v-else class="mt-10"><UiEmpty title="Aucun événement public pour l’instant" text="Les événements publiés apparaissent ici. Sois le premier à ouvrir la billetterie."><NuxtLink to="/auth/register" class="btn btn-primary mt-2">Créer un événement</NuxtLink></UiEmpty></div></section>

    <!-- CTA -->
    <section class="container-x pb-8"><div class="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-accent/25 via-surface to-accent2/30 p-10 text-center sm:p-16"><div class="grain" /><ParticleField :intensity="0.4" :interactive="false" />
      <h2 class="relative text-[clamp(1.8rem,4vw,3rem)] font-black">Prêt à ouvrir la porte ?</h2><p class="relative mx-auto mt-4 max-w-xl text-muted">Crée ton compte, publie ton événement et partage ton lien. Les ventes commencent dès que la billetterie est ouverte.</p><NuxtLink to="/auth/register" class="btn btn-primary relative mt-8 !min-h-[52px] px-8 text-base">Commencer gratuitement</NuxtLink></div></section>

    <!-- FAQ -->
    <section id="faq" class="container-x scroll-mt-20 py-24"><h2 class="text-[clamp(1.8rem,4vw,3rem)] font-black">Questions fréquentes</h2>
      <div class="mt-10 max-w-3xl divide-y divide-line rounded-tk border border-line bg-surface/40"><details v-for="f in faq" :key="f[0]" class="group p-5"><summary class="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 font-bold">{{ f[0] }}<span class="text-accent transition group-open:rotate-45" aria-hidden="true">+</span></summary><p class="mt-2 text-muted">{{ f[1] }}</p></details></div></section>
  </div>
</template>
