import sanitizeHtml from 'sanitize-html'

export function sanitizeEventDescription(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 's', 'u', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3'],
    allowedAttributes: {},
    allowedSchemes: ['http', 'https', 'mailto']
  })
}
