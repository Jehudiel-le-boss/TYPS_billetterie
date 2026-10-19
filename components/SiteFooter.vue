<template>
  <footer class="relative mt-24 border-t border-line/60">
    <div class="container-x grid gap-10 py-12 md:grid-cols-4">
      <div class="md:col-span-2"><LogoMark /><p class="mt-3 max-w-sm text-sm text-muted">Ton événement. Ton ticket. Ton contrôle. La billetterie qui te laisse créer, vendre et contrôler depuis ton navigateur.</p></div>
      <nav aria-label="Produit"><p class="mb-3 text-sm font-bold">Produit</p><ul class="space-y-2 text-sm text-muted"><li><NuxtLink to="/events" class="hover:text-fg">Explorer les événements</NuxtLink></li><li><NuxtLink to="/auth/register" class="hover:text-fg">Créer un événement</NuxtLink></li><li><NuxtLink to="/scan" class="hover:text-fg">Scanner</NuxtLink></li></ul></nav>
      <nav aria-label="Informations légales"><p class="mb-3 text-sm font-bold">Légal</p><ul class="space-y-2 text-sm text-muted"><li><NuxtLink to="/legal/conditions" class="hover:text-fg">Conditions de vente</NuxtLink></li><li><NuxtLink to="/legal/confidentialite" class="hover:text-fg">Confidentialité</NuxtLink></li><li><NuxtLink to="/legal/remboursement" class="hover:text-fg">Politique de remboursement</NuxtLink></li></ul></nav>
    </div>
    <div class="border-t border-line/60 py-5 text-center text-xs text-muted">© {{ new Date().getFullYear() }} TYPS. Tous droits réservés.</div>
  </footer>
</template>
