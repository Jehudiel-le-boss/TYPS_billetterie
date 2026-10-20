import { sanitizeHtml } from '~~/shared/rich-text'

export function sanitizeEventDescription(value: string): string {
  return sanitizeHtml(value)
}
