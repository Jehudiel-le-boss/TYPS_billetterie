<script setup lang="ts">
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'

const props = defineProps<{ modelValue: string; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
const editor = useEditor({
  extensions: [StarterKit],
  content: props.modelValue ? (/<\/?[a-z][\s\S]*>/i.test(props.modelValue) ? props.modelValue : `<p>${escapeText(props.modelValue)}</p>`) : '',
  editorProps: { attributes: { class: 'min-h-40 max-w-none px-3 py-3 text-sm outline-none focus:outline-none', 'aria-label': props.label } },
  onUpdate: ({ editor: instance }) => emit('update:modelValue', instance.getHTML())
})
const characterCount = computed(() => editor.value?.getText().length ?? 0)
watch(() => props.modelValue, (value) => {
  const instance = editor.value
  if (!instance || instance.getHTML() === value) return
  const content = value ? (/<\/?[a-z][\s\S]*>/i.test(value) ? value : `<p>${escapeText(value)}</p>`) : ''
  instance.commands.setContent(content, { emitUpdate: false })
})
function toggle(command: 'bold' | 'italic' | 'bulletList' | 'orderedList') {
  const chain = editor.value?.chain().focus()
  if (!chain) return
  if (command === 'bold') chain.toggleBold().run()
  if (command === 'italic') chain.toggleItalic().run()
  if (command === 'bulletList') chain.toggleBulletList().run()
  if (command === 'orderedList') chain.toggleOrderedList().run()
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-line bg-bg">
    <div class="flex flex-wrap gap-1 border-b border-line bg-surface/60 p-2" role="toolbar" :aria-label="`Mise en forme : ${label}`">
      <button type="button" class="btn btn-ghost !min-h-[38px] !px-3 font-bold" aria-label="Gras" :aria-pressed="editor?.isActive('bold') ?? false" @click="toggle('bold')">G</button>
      <button type="button" class="btn btn-ghost !min-h-[38px] !px-3 italic" aria-label="Italique" :aria-pressed="editor?.isActive('italic') ?? false" @click="toggle('italic')">I</button>
      <button type="button" class="btn btn-ghost !min-h-[38px] !px-3" aria-label="Liste à puces" :aria-pressed="editor?.isActive('bulletList') ?? false" @click="toggle('bulletList')">• Liste</button>
      <button type="button" class="btn btn-ghost !min-h-[38px] !px-3" aria-label="Liste numérotée" :aria-pressed="editor?.isActive('orderedList') ?? false" @click="toggle('orderedList')">1. Liste</button>
    </div>
    <EditorContent :editor="editor" />
    <p class="border-t border-line px-3 py-2 text-right text-xs text-muted">{{ characterCount }} caractère{{ characterCount > 1 ? 's' : '' }}</p>
  </div>
</template>
