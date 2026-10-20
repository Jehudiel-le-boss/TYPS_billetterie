import sanitizeHtmlLibrary from 'sanitize-html'

const allowedTags = [
  ...sanitizeHtmlLibrary.defaults.allowedTags,
  'h4', 'u', 's', 'blockquote', 'pre', 'code', 'hr', 'img', 'span', 'mark'
]

const sanitizeOptions: sanitizeHtmlLibrary.IOptions = {
  allowedTags,
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    span: ['style'],
    p: ['style'],
    h2: ['style'],
    h3: ['style'],
    h4: ['style'],
    li: ['style'],
    mark: ['style']
  },
  allowedStyles: {
    '*': {
      color: [/^(#[0-9a-f]{3,8}|rgb[a]?\([\d\s.,%]+\)|[a-z]+)$/i],
      'background-color': [/^(#[0-9a-f]{3,8}|rgb[a]?\([\d\s.,%]+\)|[a-z]+)$/i],
      'text-align': [/^(left|right|center|justify)$/i]
    }
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtmlLibrary.simpleTransform('a', { rel: 'noopener noreferrer' }, true)
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function renderLegacyNode(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const value = node as { type?: string; text?: string; content?: unknown[]; attrs?: Record<string, unknown>; marks?: { type?: string; attrs?: Record<string, unknown> }[] }
  if (value.type === 'text') {
    let text = escapeHtml(value.text ?? '')
    for (const mark of value.marks ?? []) {
      if (mark.type === 'bold') text = `<strong>${text}</strong>`
      else if (mark.type === 'italic') text = `<em>${text}</em>`
      else if (mark.type === 'strike') text = `<s>${text}</s>`
      else if (mark.type === 'underline') text = `<u>${text}</u>`
      else if (mark.type === 'code') text = `<code>${text}</code>`
      else if (mark.type === 'link') text = `<a href="${escapeHtml(String(mark.attrs?.href ?? ''))}">${text}</a>`
    }
    return text
  }
  const children = (value.content ?? []).map(renderLegacyNode).join('')
  const tags: Record<string, string> = {
    doc: 'div', paragraph: 'p', heading: `h${Math.min(4, Math.max(2, Number(value.attrs?.level) || 2))}`,
    bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote',
    codeBlock: 'pre', horizontalRule: 'hr'
  }
  const tag = value.type ? tags[value.type] : undefined
  return tag ? `<${tag}>${tag === 'hr' ? '' : children}</${tag}>` : children
}

export function sanitizeHtml(value: string): string {
  return sanitizeHtmlLibrary(value, sanitizeOptions)
}

export function plainTextToHtml(value: string): string {
  return value.split(/\r?\n/).map((line) => `<p>${escapeHtml(line)}</p>`).join('')
}

export function toEditorHtml(value: string | null | undefined): string {
  const raw = String(value ?? '')
  if (!raw.trim()) return ''
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = null
  }
  if (parsed && typeof parsed === 'object' && 'type' in parsed) return sanitizeHtml(renderLegacyNode(parsed))
  return /<\/?[a-z][\s\S]*>/i.test(raw) ? sanitizeHtml(raw) : plainTextToHtml(raw)
}

export function htmlToPlainText(value: string): string {
  return sanitizeHtml(value).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h[2-4]|blockquote|pre)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

export function richTextLength(value: string): number {
  return Array.from(htmlToPlainText(value).replace(/\s+/g, ' ').trim()).length
}

export function isRichTextEmpty(value: string): boolean {
  return !htmlToPlainText(value).trim()
}

export function toSafeHtml(value: string | null | undefined): string {
  return toEditorHtml(value)
}
