// Mode hors ligne limité : pack d'empreintes (jamais le secret de signature), chiffré AES-GCM (clé non exportable en IndexedDB), expirant.
const DB = 'typs-offline'
const idb = <T>(fn: (s: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode = 'readonly') => new Promise<T>((res, rej) => {
  const o = indexedDB.open(DB, 1); o.onupgradeneeded = () => o.result.createObjectStore('kv')
  o.onsuccess = () => { const r = fn(o.result.transaction('kv', mode).objectStore('kv')); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }; o.onerror = () => rej(o.error)
})
async function key(): Promise<CryptoKey> {
  const k = await idb<CryptoKey | undefined>((s) => s.get('key'))
  if (k) return k
  const n = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await idb((s) => s.put(n, 'key'), 'readwrite'); return n
}
async function put(name: string, data: unknown) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await key(), new TextEncoder().encode(JSON.stringify(data))); await idb((s) => s.put({ iv, ct }, name), 'readwrite') }
async function get<T>(name: string): Promise<T | null> { const v = await idb<{ iv: Uint8Array; ct: ArrayBuffer } | undefined>((s) => s.get(name)); if (!v) return null; try { return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: v.iv as BufferSource }, await key(), v.ct))) } catch { return null } }
export async function sha24(text: string) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.trim())); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24) }
export interface Pack { eventId: string; expiresAt: string; tickets: { d: string; r: string; c: string; vip: boolean }[] }
export interface QueuedScan { digest: string; scannedAt: string; gate: string }
export const offlineStore = {
  savePack: (p: Pack) => put(`pack:${p.eventId}`, p), loadPack: (id: string) => get<Pack>(`pack:${id}`),
  saveQueue: (id: string, q: QueuedScan[]) => put(`queue:${id}`, q), loadQueue: async (id: string) => (await get<QueuedScan[]>(`queue:${id}`)) ?? [],
  clear: async (id: string) => { await idb((s) => s.delete(`pack:${id}`), 'readwrite'); await idb((s) => s.delete(`queue:${id}`), 'readwrite') }
}
