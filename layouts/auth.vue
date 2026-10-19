<template>
  <div class="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
    <ParticleField :intensity="0.5" /><div class="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-accent2/20 blur-3xl" />
    <div class="relative w-full max-w-md"><NuxtLink to="/" class="mb-6 flex justify-center" aria-label="TYPS, accueil"><LogoMark /></NuxtLink><div class="card p-6 sm:p-8"><slot /></div></div>
  </div>
</template>
