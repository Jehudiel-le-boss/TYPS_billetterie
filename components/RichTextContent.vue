<script lang="ts">
/**
 * RichTextContent — affichage sécurisé du texte riche enregistré sur TYPS.
 * ---------------------------------------------------------------------------
 * Rôle : rendre un contenu écrit dans <RichTextEditor> (texte brut, HTML ou
 * ancien JSON Tiptap) sous forme de HTML nettoyé et sûr.
 *
 * POURQUOI PAS UNE INSTANCE TIPTAP (version précédente, `.client.vue`)
 * ---------------------------------------------------------------------------
 * 1. COHÉRENCE : l'affichage utilisait ProseMirror comme « nettoyeur » alors
 *    que l'API et l'éditeur utilisent `shared/rich-text.ts`. Deux moteurs de
 *    nettoyage = deux comportements (le JSON Tiptap historique n'était pas
 *    converti, le texte brut restait du texte brut, sans paragraphes).
 * 2. POIDS : une instance ProseMirror complète était créée pour chaque
 *    description affichée (parfois des dizaines par page, toutes en
 *    `editable: false`) — soit un éditeur complet pour afficher un paragraphe.
 * 3. RENDU HORS HYDRATATION : un composant `*.client.vue` n'existe pas au rendu
 *    serveur et n'apparaît qu'après hydratation. Le composant redevient un
 *    simple rendu HTML : il ne dépend plus ni de ProseMirror ni du cycle de vie
 *    client. (À ce jour le shell de l'application est masqué pendant
 *    l'intro-loader, donc l'apport immédiat est la cohérence et le poids ;
 *    le rendu serveur devient possible dès que ce masquage est retiré.)
 *
 * `toSafeHtml` est le point d'entrée unique de lecture : il accepte le HTML,
 * l'ancien JSON Tiptap et le texte brut, et renvoie toujours du HTML nettoyé
 * (liste blanche : voir l'en-tête de shared/rich-text.ts). Le nettoyage a lieu
 * AUSSI à l'écriture côté API, donc la base ne contient jamais de charge utile.
 */
import { computed, defineComponent, h } from 'vue'
import { toSafeHtml } from '#shared/rich-text'

export default defineComponent({
  inheritAttrs: false,
  props: {
    content: { type: String, default: '' },
    as: { type: String, default: 'div' },
    label: { type: String, default: '' }
  },
  setup(props, { attrs }) {
    const safeHtml = computed(() => toSafeHtml(props.content))
    return () => h(props.as, {
      ...attrs,
      class: ['rich-text-content', attrs.class],
      'aria-label': props.label || undefined,
      innerHTML: safeHtml.value
    })
  }
})
</script>
