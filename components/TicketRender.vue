<script setup lang="ts">
// Rendu HTML d'un gabarit de billet (même JSON que le moteur PDF). Pur : aucune interaction.
import { CSS_FONT, CSS_FONT_STYLE, resolveField, type TemplateLayout, type TicketContext, type TplElement } from '~~/shared/template'
const props = defineProps<{ layout: TemplateLayout; ctx: TicketContext; qr: Record<string, string>; assets?: Record<string, string> }>()
const box = (el: TplElement) => ({ position: 'absolute' as const, left: el.x + 'px', top: el.y + 'px', width: el.w + 'px', height: el.h + 'px', opacity: el.opacity })
const textOf = (el: TplElement) => (el.type === 'text' ? el.text : el.type === 'field' ? (el.prefix ?? '') + resolveField(el.field, props.ctx, el.dateFormat) : '')
const tstyle = (el: any) => ({ ...box(el), color: el.color, fontSize: el.fontSize + 'px', lineHeight: el.fontSize * 1.2 + 'px', fontFamily: CSS_FONT[el.font as keyof typeof CSS_FONT], fontStyle: CSS_FONT_STYLE[el.font as keyof typeof CSS_FONT_STYLE], fontWeight: el.bold ? 700 : 400, textAlign: el.align, overflow: 'hidden' })
const sstyle = (el: any) => ({ ...box(el), background: el.fill, border: el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : 'none', borderRadius: el.shape === 'ellipse' ? '50%' : el.radius + 'px', boxSizing: 'border-box' as const })
</script>
<template>
  <div class="relative overflow-hidden" :style="{ width: layout.width + 'px', height: layout.height + 'px', background: layout.background.color }">
    <img v-if="layout.background.assetId && assets?.[layout.background.assetId]" :src="assets[layout.background.assetId]" alt="" class="absolute inset-0 h-full w-full" style="object-fit: fill">
    <template v-for="el in layout.elements" :key="el.id">
      <template v-if="!el.hidden">
        <div v-if="el.type === 'shape'" :style="sstyle(el)" />
        <img v-else-if="el.type === 'qr'" :src="qr[el.id]" alt="QR code du billet" :style="{ ...box(el), objectFit: 'contain' }">
        <img v-else-if="el.type === 'image' && assets?.[el.assetId]" :src="assets[el.assetId]" alt="" :style="{ ...box(el), objectFit: el.fit }">
        <div v-else-if="el.type === 'text' || el.type === 'field'" :style="tstyle(el)">{{ textOf(el) }}</div>
      </template>
    </template>
    <span v-if="ctx.demo" class="absolute bottom-1 left-2 text-[10px] font-bold text-red-400">DÉMO — NON VALABLE</span>
  </div>
</template>
