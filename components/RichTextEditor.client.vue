<script setup lang="ts">
/**
 * RichTextEditor — éditeur riche TYPS, monté côté client pour ProseMirror.
 * ---------------------------------------------------------------------------
 * Le composant est volontairement limité au NAVIGATEUR (`.client.vue`) :
 * ProseMirror a besoin du DOM. Les pages qui l'utilisent gardent donc un
 * repli `<template #fallback>` (champ simple) pour le rendu serveur.
 *
 * API PUBLIQUE (compatibilité ascendante conservée) :
 *   - `v-model` : chaîne HTML (avant, le composant renvoyait du JSON Tiptap ;
 *     il accepte toujours ce format en entrée pour ne rien casser) ;
 *   - `@update:empty` : vrai lorsque le contenu ne contient aucun caractère ;
 *   - props optionnelles : `placeholder`, `minHeight`, `maxCharacters`,
 *     `disabled`, `compact`, `label`, `required`, `hint`.
 *
 * SECURITÉ : tout ce qui entre (`v-model` initial, contenu déjà enregistré,
 * HTML COLLÉ) et tout ce qui sort (HTML émis) passe par la liste blanche
 * `shared/rich-text.ts`. Le compteur et la limite `maxCharacters` utilisent
 * `richTextLength`, la MÊME mesure que la validation des API.
 */
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Focus from '@tiptap/extension-focus'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import UnderlineExtension from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Code, Eraser, Heading2, Heading3, Heading4, Highlighter, Image as ImageIcon, Italic, Link, List, ListOrdered, Minus, Palette, Quote, Redo2, ScanLine, SquareCode, Strikethrough, Underline as UnderlineIcon, Undo2, Unlink, type Component } from '@lucide/vue'
import { isRichTextEmpty, richTextLength, htmlToPlainText, plainTextToHtml, sanitizeHtml, toEditorHtml } from '#shared/rich-text'

const props = withDefaults(defineProps<{
  /** Contenu HTML de l'éditeur (ancien format JSON Tiptap également accepté). */
  modelValue: string
  /** Texte affiché tant que le contenu est vide. */
  placeholder?: string
  /** Hauteur minimale de la zone de saisie (nombre = pixels, ou valeur CSS). */
  minHeight?: number | string
  /** Nombre maximal de CARACTÈRES DE TEXTE (le balisage n'est pas compté).
   * Le compteur de l'éditeur utilise EXACTEMENT la mesure du serveur
   * (`richTextLength`, `shared/rich-text.ts`) ; au-delà, il passe en rouge et
   * le pied de l'éditeur signale le dépassement. La validation finale reste
   * côté API, avec la même mesure : plus de divergence possible. */
  maxCharacters?: number
  /** Éditeur inerte (lecture seule) tout en gardant le contenu visible. */
  disabled?: boolean
  /** Rendu dense (barre d'outils et zone de saisie resserrées). */
  compact?: boolean
  /** Libellé affiché au-dessus de la barre d'outils. */
  label?: string
  /**
   * Nom accessible SANS libellé visible (quand le titre du formulaire fait
   * office de libellé) : sert d'`aria-label` à la zone de saisie.
   */
  ariaLabel?: string
  /** Ajoute un astérisque au libellé et `aria-required` sur la zone de saisie. */
  required?: boolean
  /** Complément affiché dans le pied de l'éditeur (ex. minimum de caractères). */
  hint?: string
}>(), {
  placeholder: 'Décris cette activité…',
  minHeight: 160,
  maxCharacters: undefined,
  disabled: false,
  compact: false,
  label: '',
  ariaLabel: '',
  required: false,
  hint: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:empty': [value: boolean]
}>()

// ---------------------------------------------------------------------------
// Palette de base complétée par les accents du thème TYPS actif.
// ---------------------------------------------------------------------------
const BASE_TEXT_COLORS = ['#241016', '#6d4b52', '#c1122d', '#8f1023', '#1d4ed8', '#0f766e', '#7c3aed', '#b45309']
const HIGHLIGHT_COLORS = ['#ffe08a', '#ffc9d2', '#c9f0d4', '#cfe4ff', '#e6d4ff', '#ffd9b0']
const themeColors = ref<string[]>([])
const TEXT_COLORS = computed(() => [...new Set([...BASE_TEXT_COLORS, ...themeColors.value])])
let themeObserver: MutationObserver | null = null

/**
 * Astuce affichée dans le pied de l'éditeur quand il n'y a pas de `hint` :
 * le collage en texte brut (Ctrl+Maj+V) est le moyen le plus simple de coller
 * depuis Word ou une page web sans importer toute leur mise en forme.
 */
const PASTE_SHORTCUT_TIP = 'Astuce : Ctrl+Maj+V colle sans mise en forme.'

/** Panneau ouvert sous la barre d'outils (lien, image, couleur, surlignage). */
type ToolbarPanel = 'link' | 'image' | 'color' | 'highlight'

const panel = ref<ToolbarPanel | null>(null)
const panelError = ref('')
const linkDraft = ref('')
const imageDraft = ref('')
const imageAltDraft = ref('')
const notice = ref('')
const focusActive = ref(false)
const isDragging = ref(false)
const rovingIndex = ref(0)

/** Dernière valeur émise : évite une boucle `setContent` sur son propre écho. */
let lastEmitted = ''

/**
 * Identifiant unique par instance : relie le libellé visible au champ
 * (`aria-labelledby`) et le pied de l'éditeur (`aria-describedby`).
 */
let editorUidCounter = 0
const uid = `rte-${++editorUidCounter}`

/**
 * HTML NETTOYÉ courant : exactement ce qui sera enregistré en base, donc
 * exactement ce que le serveur mesurera. Le compteur s'appuie dessus.
 */
const currentHtml = ref(sanitizeHtml(toEditorHtml(props.modelValue)))

const minHeightStyle = computed(() => {
  const value = props.minHeight
  if (typeof value === 'number') return `${value}px`
  return value || '160px'
})

const editor = useEditor({
  // Le contenu initial est nettoyé et converti (ancien JSON Tiptap, HTML ou texte).
  content: toEditorHtml(props.modelValue),
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      // Les liens sont gérés par l'extension Link du kit : pas de clic
      // ouvrant un onglet pendant l'édition (source de perte de focus).
      link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] }
    }),
    TextStyle,
    Color,
    UnderlineExtension,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({ allowBase64: false, inline: false }),
    Placeholder.configure({ placeholder: () => props.placeholder, emptyEditorClass: 'is-editor-empty' }),
    // PAS de `limit` : l'extension compte les blocs SANS séparateur
    // (`textBetween(..., void 0, ' ')`), alors que le serveur compte le texte
    // du HTML enregistré (`richTextLength`, listes comprises). Un plafond posé
    // ici bloquait la frappe en silence sur une mesure fausse. Le compteur de
    // l'éditeur et la validation API partagent désormais la MÊME mesure.
    CharacterCount,
    Focus.configure({ className: 'has-focus', mode: 'deepest' })
  ],
  editorProps: {
    attributes: {
      'class': 'rich-text-editor__content',
      'role': 'textbox',
      'aria-multiline': 'true',
      // Nom accessible : le libellé visible s'il existe, sinon la prop prévue
      // pour les formulaires dont le titre fait office de libellé.
      ...(props.label
        ? { 'aria-labelledby': `${uid}-label` }
        : (props.ariaLabel ? { 'aria-label': props.ariaLabel } : {})),
      'aria-describedby': `${uid}-footer`,
      'aria-required': props.required ? 'true' : 'false'
    },
    // Tout HTML COLLÉ est nettoyé AVANT d'entrer dans l'éditeur : ce que
    // l'utilisateur voit est donc exactement ce qui sera enregistré (avant,
    // le nettoyage n'avait lieu qu'à la sortie, si bien qu'un collage pouvait
    // afficher une mise en forme définitive jamais enregistrée).
    transformPastedHTML: (html: string) => sanitizeHtml(html),
    /**
     * Images collées : les fichiers ne sont JAMAIS encodés dans la base
     * (base64), donc on les refuse. Mais un collage qui contient AUSSI du
     * texte (cas fréquent : presse-papier mixte) doit passer : on ne bloque
     * le collage que lorsqu'il n'apporte rien d'autre que l'image.
     */
    handlePaste: (_view, event) => {
      const clipboard = event.clipboardData
      const files = Array.from(clipboard?.files ?? [])
      const plainText = clipboard?.getData('text/plain') ?? ''
      const pasteWithModifiers = event as ClipboardEvent & Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>

      /**
       * COLLAGE EN TEXTE BRUT — Ctrl+Maj+V (Cmd+Maj+V sur Mac).
       * Le presse-papier d'une page web ou de Word transporte du HTML :
       * titres, couleurs, tableaux, images distantes. Sans ce raccourci, la
       * seule façon de coller du texte propre était de le retaper. Ici le
       * texte est échappé puis converti en paragraphes par le socle partagé
       * (`plainTextToHtml`) : aucune balise, aucun attribut, aucune image
       * n'entre dans l'éditeur — donc rien à nettoyer plus tard.
       */
      if ((pasteWithModifiers.ctrlKey || pasteWithModifiers.metaKey) && pasteWithModifiers.shiftKey) {
        if (!plainText.trim()) return false
        editor.value?.chain().focus().insertContent(plainTextToHtml(plainText)).run()
        notice.value = 'Collage en texte brut : la mise en forme d’origine a été ignorée.'
        return true
      }

      if (!files.some(file => file.type.startsWith('image/'))) return false

      const hasText = Boolean(
        clipboard?.getData('text/html')?.trim() || plainText.trim()
      )
      if (hasText) {
        notice.value = 'Image collée ignorée (utilise « Image par URL ») : le texte, lui, a bien été collé.'
        return false
      }

      notice.value = 'Image collée refusée : utilisez « Image par URL » (les fichiers ne sont pas stockés dans la base).'
      return true
    }
  },
  onUpdate: ({ editor: currentEditor }) => {
    const html = sanitizeHtml(currentEditor.getHTML())
    lastEmitted = html
    currentHtml.value = html
    emit('update:modelValue', html)
    emit('update:empty', currentEditor.isEmpty || isRichTextEmpty(html))
  }
})

// ---------------------------------------------------------------------------
// Synchronisation descendante (le parent peut réinitialiser le formulaire).
// ---------------------------------------------------------------------------
watch(() => props.modelValue, (value) => {
  const instance = editor.value
  if (!instance) return
  if (value === lastEmitted) return
  const next = toEditorHtml(value)
  if (next === sanitizeHtml(instance.getHTML())) return
  instance.commands.setContent(next, { emitUpdate: false })
  currentHtml.value = sanitizeHtml(instance.getHTML())
  emit('update:empty', instance.isEmpty || isRichTextEmpty(next))
})

watch(() => props.disabled, (value) => {
  editor.value?.setEditable(!value)
})

// Hauteur minimale pilotée par la prop : utilisée par le CSS de l'éditeur.
const rootStyle = computed(() => ({ '--rte-min-height': minHeightStyle.value }))

/**
 * Nombre de caractères de TEXTE : même fonction que le serveur
 * (`richTextLength` de shared/rich-text.ts), appliquée au même HTML nettoyé.
 * Ce que l'utilisateur lit est donc ce que l'API validera.
 */
const characterCount = computed(() => richTextLength(currentHtml.value))

/** Nombre de mots du texte visible (information du pied de l'éditeur). */
const wordCount = computed(() => {
  const text = htmlToPlainText(currentHtml.value).trim()
  return text ? text.split(/\s+/).length : 0
})

const isOverLimit = computed(() => Boolean(props.maxCharacters) && characterCount.value > (props.maxCharacters ?? 0))

// ---------------------------------------------------------------------------
// Barre d'outils déclarative : libellé, icône, raccourci et état actif.
// ---------------------------------------------------------------------------
interface ToolbarItem {
  id: string
  label: string
  icon: string
  shortcut?: string
  active: boolean
  disabled: boolean
  /** Position dans la barre (modèle ARIA : une seule tabulation). */
  index: number
  run: () => void
}

interface ToolbarGroup {
  id: string
  label: string
  items: ToolbarItem[]
}

/** Chaîne de commandes ciblant l'éditeur, ou `undefined` s'il n'est pas prêt. */
function chain() {
  return editor.value?.chain().focus()
}

const toolbarGroups = computed<ToolbarGroup[]>(() => {
  const instance = editor.value
  if (!instance) return []
  const editable = !props.disabled

  const asButton = (item: {
    id: string
    label: string
    icon: string
    shortcut?: string
    active?: boolean
    disabled?: boolean
    run: () => void
  }): Omit<ToolbarItem, 'index'> => ({
    id: item.id,
    label: item.shortcut ? `${item.label} (${item.shortcut})` : item.label,
    icon: item.icon,
    shortcut: item.shortcut,
    active: Boolean(item.active),
    disabled: !editable || Boolean(item.disabled),
    run: item.run
  })

  const groups: Array<Omit<ToolbarGroup, 'items'> & { items: Array<Omit<ToolbarItem, 'index'>> }> = [
    {
      id: 'history',
      label: 'Historique',
      items: [
        asButton({
          id: 'undo',
          label: 'Annuler',
          icon: 'i-lucide-undo-2',
          shortcut: 'Ctrl+Z',
          disabled: !instance.can().undo(),
          run: () => { chain()?.undo().run() }
        }),
        asButton({
          id: 'redo',
          label: 'Rétablir',
          icon: 'i-lucide-redo-2',
          shortcut: 'Ctrl+Y',
          disabled: !instance.can().redo(),
          run: () => { chain()?.redo().run() }
        })
      ]
    },
    {
      id: 'titles',
      label: 'Titres',
      items: [
        asButton({
          id: 'h2',
          label: 'Titre niveau 2',
          icon: 'i-lucide-heading-2',
          active: instance.isActive('heading', { level: 2 }),
          run: () => { chain()?.toggleHeading({ level: 2 }).run() }
        }),
        asButton({
          id: 'h3',
          label: 'Titre niveau 3',
          icon: 'i-lucide-heading-3',
          active: instance.isActive('heading', { level: 3 }),
          run: () => { chain()?.toggleHeading({ level: 3 }).run() }
        }),
        asButton({
          id: 'h4',
          label: 'Titre niveau 4',
          icon: 'i-lucide-heading-4',
          active: instance.isActive('heading', { level: 4 }),
          run: () => { chain()?.toggleHeading({ level: 4 }).run() }
        })
      ]
    },
    {
      id: 'marks',
      label: 'Mise en forme du texte',
      items: [
        asButton({
          id: 'bold',
          label: 'Gras',
          icon: 'i-lucide-bold',
          shortcut: 'Ctrl+B',
          active: instance.isActive('bold'),
          run: () => { chain()?.toggleBold().run() }
        }),
        asButton({
          id: 'italic',
          label: 'Italique',
          icon: 'i-lucide-italic',
          shortcut: 'Ctrl+I',
          active: instance.isActive('italic'),
          run: () => { chain()?.toggleItalic().run() }
        }),
        asButton({
          id: 'underline',
          label: 'Souligné',
          icon: 'i-lucide-underline',
          shortcut: 'Ctrl+U',
          active: instance.isActive('underline'),
          run: () => { chain()?.toggleUnderline().run() }
        }),
        asButton({
          id: 'strike',
          label: 'Barré',
          icon: 'i-lucide-strikethrough',
          active: instance.isActive('strike'),
          run: () => { chain()?.toggleStrike().run() }
        }),
        asButton({
          id: 'code',
          label: 'Code en ligne',
          icon: 'i-lucide-code',
          active: instance.isActive('code'),
          run: () => { chain()?.toggleCode().run() }
        })
      ]
    },
    {
      id: 'blocks',
      label: 'Listes et blocs',
      items: [
        asButton({
          id: 'bulletList',
          label: 'Liste à puces',
          icon: 'i-lucide-list',
          shortcut: 'Ctrl+Maj+8',
          active: instance.isActive('bulletList'),
          run: () => { chain()?.toggleBulletList().run() }
        }),
        asButton({
          id: 'orderedList',
          label: 'Liste numérotée',
          icon: 'i-lucide-list-ordered',
          shortcut: 'Ctrl+Maj+7',
          active: instance.isActive('orderedList'),
          run: () => { chain()?.toggleOrderedList().run() }
        }),
        asButton({
          id: 'blockquote',
          label: 'Citation',
          icon: 'i-lucide-quote',
          active: instance.isActive('blockquote'),
          run: () => { chain()?.toggleBlockquote().run() }
        }),
        asButton({
          id: 'codeBlock',
          label: 'Bloc de code',
          icon: 'i-lucide-square-code',
          active: instance.isActive('codeBlock'),
          run: () => { chain()?.toggleCodeBlock().run() }
        }),
        asButton({
          id: 'horizontalRule',
          label: 'Séparateur',
          icon: 'i-lucide-minus',
          run: () => { chain()?.setHorizontalRule().run() }
        })
      ]
    },
    {
      id: 'align',
      label: 'Alignement',
      items: [
        asButton({
          id: 'alignLeft',
          label: 'Aligner à gauche',
          icon: 'i-lucide-align-left',
          active: instance.isActive({ textAlign: 'left' }),
          run: () => { chain()?.setTextAlign('left').run() }
        }),
        asButton({
          id: 'alignCenter',
          label: 'Centrer',
          icon: 'i-lucide-align-center',
          active: instance.isActive({ textAlign: 'center' }),
          run: () => { chain()?.setTextAlign('center').run() }
        }),
        asButton({
          id: 'alignRight',
          label: 'Aligner à droite',
          icon: 'i-lucide-align-right',
          active: instance.isActive({ textAlign: 'right' }),
          run: () => { chain()?.setTextAlign('right').run() }
        }),
        asButton({
          id: 'alignJustify',
          label: 'Justifier',
          icon: 'i-lucide-align-justify',
          active: instance.isActive({ textAlign: 'justify' }),
          run: () => { chain()?.setTextAlign('justify').run() }
        })
      ]
    },
    {
      id: 'insert',
      label: 'Insertions',
      items: [
        asButton({
          id: 'link',
          label: 'Insérer un lien',
          icon: 'i-lucide-link',
          active: instance.isActive('link') || panel.value === 'link',
          run: () => openPanel('link')
        }),
        asButton({
          id: 'unlink',
          label: 'Retirer le lien',
          icon: 'i-lucide-unlink',
          disabled: !instance.isActive('link'),
          run: () => { chain()?.extendMarkRange('link').unsetLink().run() }
        }),
        asButton({
          id: 'image',
          label: 'Image par URL',
          icon: 'i-lucide-image',
          active: panel.value === 'image',
          run: () => openPanel('image')
        }),
        asButton({
          id: 'color',
          label: 'Couleur du texte',
          icon: 'i-lucide-palette',
          active: instance.isActive('textStyle') || panel.value === 'color',
          run: () => openPanel('color')
        }),
        asButton({
          id: 'highlight',
          label: 'Surlignage',
          icon: 'i-lucide-highlighter',
          active: instance.isActive('highlight') || panel.value === 'highlight',
          run: () => openPanel('highlight')
        }),
        asButton({
          id: 'clear',
          label: 'Effacer la mise en forme',
          icon: 'i-lucide-eraser',
          run: () => { chain()?.unsetAllMarks().clearNodes().run() }
        }),
        asButton({
          id: 'focus',
          label: focusActive.value ? 'Quitter le mode focus' : 'Mode focus',
          icon: 'i-lucide-scan',
          active: focusActive.value,
          run: () => { focusActive.value = !focusActive.value }
        })
      ]
    }
  ]

  // Numérotation à plat : sert au modèle ARIA de la barre d'outils.
  let index = 0
  return groups.map(group => ({
    id: group.id,
    label: group.label,
    items: group.items.map(item => ({ ...item, index: index++ }))
  }))
})

const toolbarIcons: Record<string, Component> = {
  undo: Undo2, redo: Redo2, h2: Heading2, h3: Heading3, h4: Heading4,
  bold: Bold, italic: Italic, underline: UnderlineIcon, strike: Strikethrough,
  code: Code, bulletList: List, orderedList: ListOrdered, blockquote: Quote,
  codeBlock: SquareCode, horizontalRule: Minus, alignLeft: AlignLeft,
  alignCenter: AlignCenter, alignRight: AlignRight, alignJustify: AlignJustify,
  link: Link, unlink: Unlink, image: ImageIcon, color: Palette,
  highlight: Highlighter, clear: Eraser, focus: ScanLine
}

function toolbarIcon(name: string): Component {
  return toolbarIcons[name.replace(/^i-lucide-/, '')] ?? Code
}

// ---------------------------------------------------------------------------
// Panneaux : lien, image, couleurs
// ---------------------------------------------------------------------------
function openPanel(next: ToolbarPanel) {
  panelError.value = ''
  notice.value = ''

  if (panel.value === next) {
    panel.value = null
    return
  }

  if (next === 'link') {
    linkDraft.value = String(editor.value?.getAttributes('link').href ?? '')
  }

  if (next === 'image') {
    imageDraft.value = ''
    imageAltDraft.value = ''
  }

  panel.value = next
}

/** Complète l'URL saisie (`exemple.com` → `https://exemple.com`) puis la valide. */
function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed
  if (trimmed.includes('@') && !trimmed.includes('/')) return `mailto:${trimmed}`
  return `https://${trimmed}`
}

function applyLink() {
  const value = normalizeUrl(linkDraft.value)
  if (!value || !isSafeLink(value)) {
    panelError.value = 'Adresse refusée : seuls http(s), mailto, tel ou un chemin interne sont autorisés.'
    return
  }
  chain()?.extendMarkRange('link').setLink({ href: value }).run()
  panel.value = null
}

function applyImage() {
  const value = normalizeUrl(imageDraft.value)
  if (!/^https?:\/\//i.test(value) && !value.startsWith('/')) {
    panelError.value = 'Image refusée : indiquez une adresse http(s) ou un chemin du site.'
    return
  }
  chain()?.setImage({ src: value, alt: imageAltDraft.value.trim() }).run()
  panel.value = null
}

/** Vérifie qu'une adresse ne peut pas exécuter de code (voir shared/rich-text). */
function isSafeLink(value: string) {
  const probe = sanitizeHtml(`<a href="${value.replace(/"/g, '&quot;')}">x</a>`)
  return probe.includes('href=')
}

// ---------------------------------------------------------------------------
// Accessibilité : modèle ARIA « toolbar » (une seule tabulation, flèches pour
// circuler d'un bouton à l'autre).
// ---------------------------------------------------------------------------
const toolbarElement = ref<HTMLElement | null>(null)

function onToolbarKeydown(event: KeyboardEvent) {
  const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'Escape']
  if (!keys.includes(event.key)) return

  if (event.key === 'Escape') {
    panel.value = null
    panelError.value = ''
    return
  }

  const buttons = Array.from(
    toolbarElement.value?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []
  )
  if (!buttons.length) return

  const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
  let nextIndex = currentIndex

  if (event.key === 'ArrowRight') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length
  else if (event.key === 'ArrowLeft') nextIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1
  else if (event.key === 'Home') nextIndex = 0
  else nextIndex = buttons.length - 1

  event.preventDefault()
  rovingIndex.value = nextIndex
  nextTick(() => buttons[nextIndex]?.focus())
}

function onButtonFocus(index: number) {
  rovingIndex.value = index
}

/** Glisser-déposer : les fichiers image sont explicitement refusés. */
function onWrapperDrop(event: DragEvent) {
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.some(file => file.type.startsWith('image/'))) {
    event.preventDefault()
    event.stopPropagation()
    notice.value = 'Image déposée refusée : utilisez « Image par URL » (aucun fichier n’est stocké dans la base).'
  }
}

onBeforeUnmount(() => {
  notice.value = ''
  themeObserver?.disconnect()
  themeObserver = null
})

onMounted(() => {
  const instance = editor.value
  const refreshThemeColors = () => {
    const styles = getComputedStyle(document.documentElement)
    themeColors.value = ['--c-a', '--c-b', '--c-fg', '--c-muted']
      .map((name) => styles.getPropertyValue(name).trim())
      .filter(Boolean)
      .map((value) => `rgb(${value.replace(/\s+/g, ', ')})`)
  }
  refreshThemeColors()
  themeObserver = new MutationObserver(refreshThemeColors)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
  if (!instance) return
  emit('update:empty', instance.isEmpty || isRichTextEmpty(instance.getHTML()))
})
</script>

<template>
  <div
    class="rich-text-editor"
    :class="{
      'rich-text-editor--compact': compact,
      'is-disabled': disabled,
      'is-dragover': isDragging,
      'is-focus': focusActive
    }"
    :style="rootStyle"
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop="onWrapperDrop"
  >
    <p
      v-if="label"
      :id="`${uid}-label`"
      class="rich-text-editor__label"
    >
      {{ label }}
      <span
        v-if="required"
        class="rich-text-editor__required"
        aria-hidden="true"
      >*</span>
    </p>

    <div
      ref="toolbarElement"
      class="rich-text-editor__toolbar"
      role="toolbar"
      aria-label="Mise en forme du texte"
      aria-orientation="horizontal"
      @keydown="onToolbarKeydown"
    >
      <template
        v-for="(group, groupIndex) in toolbarGroups"
        :key="group.id"
      >
        <span
          v-if="groupIndex > 0"
          class="rich-text-editor__divider"
          role="separator"
          aria-hidden="true"
        />
        <div
          class="rich-text-editor__group"
          role="group"
          :aria-label="group.label"
        >
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="rich-text-editor__btn"
            :class="{ 'is-active': item.active }"
            :title="item.label"
            :aria-label="item.label"
            :aria-pressed="item.active"
            :tabindex="rovingIndex === item.index ? 0 : -1"
            :disabled="item.disabled"
            @click="item.run()"
            @focus="onButtonFocus(item.index)"
          >
            <component
              :is="toolbarIcon(item.id)"
              class="h-4 w-4"
              aria-hidden="true"
            />
          </button>
        </div>
      </template>
    </div>

    <!-- Panneau : lien -->
    <div
      v-if="panel === 'link'"
      class="rich-text-editor__popover"
    >
      <label
        class="sr-only"
        for="rte-link-url"
      >Adresse du lien</label>
      <input
        id="rte-link-url"
        v-model="linkDraft"
        class="rich-text-editor__input"
        type="url"
        inputmode="url"
        placeholder="https://exemple.com ou /evenements"
        @keydown.enter.prevent="applyLink"
      >
      <button
        type="button"
        class="rich-text-editor__btn rich-text-editor__btn--text"
        @click="applyLink"
      >
        Appliquer
      </button>
      <button
        type="button"
        class="rich-text-editor__btn rich-text-editor__btn--text"
        @click="panel = null"
      >
        Fermer
      </button>
      <p
        v-if="panelError"
        class="rich-text-editor__hint"
        role="alert"
        style="color: var(--primary-color);"
      >
        {{ panelError }}
      </p>
    </div>

    <!-- Panneau : image par URL -->
    <div
      v-else-if="panel === 'image'"
      class="rich-text-editor__popover"
    >
      <label
        class="sr-only"
        for="rte-image-url"
      >Adresse de l’image</label>
      <input
        id="rte-image-url"
        v-model="imageDraft"
        class="rich-text-editor__input"
        type="url"
        inputmode="url"
        placeholder="https://exemple.com/photo.webp"
        @keydown.enter.prevent="applyImage"
      >
      <label
        class="sr-only"
        for="rte-image-alt"
      >Texte alternatif</label>
      <input
        id="rte-image-alt"
        v-model="imageAltDraft"
        class="rich-text-editor__input"
        type="text"
        placeholder="Description de l’image (accessibilité)"
        @keydown.enter.prevent="applyImage"
      >
      <button
        type="button"
        class="rich-text-editor__btn rich-text-editor__btn--text"
        @click="applyImage"
      >
        Insérer
      </button>
      <button
        type="button"
        class="rich-text-editor__btn rich-text-editor__btn--text"
        @click="panel = null"
      >
        Fermer
      </button>
      <p
        v-if="panelError"
        class="rich-text-editor__hint"
        role="alert"
        style="color: var(--primary-color);"
      >
        {{ panelError }}
      </p>
    </div>

    <!-- Panneau : couleur du texte -->
    <div
      v-else-if="panel === 'color'"
      class="rich-text-editor__popover"
    >
      <div
        class="rich-text-editor__palette"
        role="group"
        aria-label="Couleurs du texte"
      >
        <button
          v-for="color in TEXT_COLORS"
          :key="color"
          type="button"
          class="rich-text-editor__swatch"
          :style="{ background: color }"
          :title="`Couleur ${color}`"
          :aria-label="`Appliquer la couleur ${color}`"
          @click="chain()?.setColor(color).run(); panel = null"
        />
      </div>
      <button
        type="button"
        class="rich-text-editor__btn rich-text-editor__btn--text"
        @click="chain()?.unsetColor().run(); panel = null"
      >
        Couleur par défaut
      </button>
    </div>

    <!-- Panneau : surlignage -->
    <div
      v-else-if="panel === 'highlight'"
      class="rich-text-editor__popover"
    >
      <div
        class="rich-text-editor__palette"
        role="group"
        aria-label="Couleurs de surlignage"
      >
        <button
          v-for="color in HIGHLIGHT_COLORS"
          :key="color"
          type="button"
          class="rich-text-editor__swatch"
          :style="{ background: color }"
          :title="`Surlignage ${color}`"
          :aria-label="`Surligner en ${color}`"
          @click="chain()?.setHighlight({ color }).run(); panel = null"
        />
      </div>
      <button
        type="button"
        class="rich-text-editor__btn rich-text-editor__btn--text"
        @click="chain()?.unsetHighlight().run(); panel = null"
      >
        Retirer le surlignage
      </button>
    </div>

    <EditorContent :editor="editor" />

    <div
      v-if="maxCharacters || hint || notice"
      :id="`${uid}-footer`"
      class="rich-text-editor__footer"
    >
      <span
        v-if="notice"
        role="status"
      >{{ notice }}</span>
      <span
        v-else-if="hint"
        class="rich-text-editor__hint"
      >{{ hint }}</span>
      <span
        v-else
        class="rich-text-editor__hint"
      >{{ PASTE_SHORTCUT_TIP }}</span>
      <span
        v-if="maxCharacters"
        :class="{ 'rich-text-editor__counter--over': isOverLimit }"
        role="status"
        aria-live="polite"
      >
        {{ characterCount }} / {{ maxCharacters }} caractères
        <template v-if="wordCount"> · {{ wordCount }} mot(s)</template>
      </span>
      <span
        v-if="isOverLimit"
        class="rich-text-editor__counter--over"
        role="alert"
      >
        Trop long de {{ characterCount - (maxCharacters ?? 0) }} caractère(s) : raccourcis le texte avant d’enregistrer.
      </span>
    </div>
  </div>
</template>
