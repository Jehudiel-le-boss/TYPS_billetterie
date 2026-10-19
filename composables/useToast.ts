export interface Toast { id: number; msg: string; kind: 'ok' | 'err' | 'info' }
let n = 0
export function useToast() {
  const list = useState<Toast[]>('toasts', () => [])
  const push = (msg: string, kind: Toast['kind'] = 'info') => { const id = ++n; list.value = [...list.value, { id, msg, kind }]; if (import.meta.client) setTimeout(() => { list.value = list.value.filter((t) => t.id !== id) }, 4500) }
  return { list, ok: (m: string) => push(m, 'ok'), err: (m: string) => push(m, 'err'), info: (m: string) => push(m, 'info'), dismiss: (id: number) => { list.value = list.value.filter((t) => t.id !== id) } }
}
