import { and, eq, sql } from 'drizzle-orm'
import { checkIns, events, ticketCategories, tickets, offlineScanSyncs } from '../db/schema'
import type { Db } from '../utils/db'
import { offlineDigest, signTicketCode, verifyTicketCode } from '../utils/qr'

export type ScanResultKind = 'accepted' | 'already_used' | 'invalid' | 'cancelled' | 'refunded' | 'suspended' | 'wrong_event' | 'not_started'
export interface ScanOutcome { result: ScanResultKind; ticket?: { id: string; ref: string; category: string; vip: boolean; holder: string }; previous?: { at: Date | null; gate: string | null }; eventTitle?: string }
const mask = (name: string) => { const p = name.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1]![0]}.` : p[0] ?? '' }

export interface ScanInput { eventId: string; code: string; gate: string; agentId: string | null; deviceId?: string; source?: 'online' | 'offline'; scannedAt?: Date; secret?: string }

/** Validation d'un scan, atomique : un seul UPDATE conditionnel (status = 'valid') décide qui entre. Deux scans simultanés → un seul `accepted`. */
export async function processScan(db: Db, i: ScanInput): Promise<ScanOutcome> {
  const when = i.scannedAt ?? new Date()
  const record = (result: ScanResultKind, ticketId: string | null, conflict = false) =>
    db.insert(checkIns).values({ eventId: i.eventId, ticketId, result, gate: i.gate, agentId: i.agentId, deviceId: i.deviceId, source: i.source ?? 'online', conflict, scannedAt: when })
  const parsed = verifyTicketCode(i.code, i.secret)
  if (!parsed) { await record('invalid', null); return { result: 'invalid' } }
  return scanTicket(db, i, parsed.ticketId, parsed.version, when, record)
}
async function scanTicket(db: Db, i: ScanInput, ticketId: string, version: number, when: Date, record: (r: ScanResultKind, t: string | null, c?: boolean) => Promise<unknown>): Promise<ScanOutcome> {
  const [row] = await db.select({ t: tickets, c: ticketCategories, e: events }).from(tickets).innerJoin(ticketCategories, eq(ticketCategories.id, tickets.categoryId)).innerJoin(events, eq(events.id, tickets.eventId)).where(eq(tickets.id, ticketId)).limit(1)
  if (!row) { await record('invalid', null); return { result: 'invalid' } }
  const info = { id: row.t.id, ref: row.t.ref, category: row.c.name, vip: row.c.vip, holder: mask(row.t.holderName) }
  if (row.t.eventId !== i.eventId) { await record('wrong_event', row.t.id); return { result: 'wrong_event' } }
  if (row.e.status === 'suspended' || row.e.status === 'cancelled' || row.e.status === 'draft') { await record('suspended', row.t.id); return { result: 'suspended', ticket: info, eventTitle: row.e.title } }
  if ((row.c.validFrom && row.c.validFrom > when) || (row.c.validUntil && row.c.validUntil < when)) { await record('not_started', row.t.id); return { result: 'not_started', ticket: info, eventTitle: row.e.title } }
  if (row.t.qrVersion !== version) { await record('invalid', row.t.id); return { result: 'invalid', ticket: info } }
  const [won] = await db.update(tickets).set({ status: 'used', usedAt: when, usedBy: i.agentId })
    .where(and(eq(tickets.id, ticketId), eq(tickets.eventId, i.eventId), eq(tickets.qrVersion, version), eq(tickets.status, 'valid'))).returning({ id: tickets.id })
  if (won) { await record('accepted', ticketId); return { result: 'accepted', ticket: info, eventTitle: row.e.title } }
  // Perdu : relire l'état courant pour expliquer pourquoi.
  const [cur] = await db.select({ status: tickets.status, usedAt: tickets.usedAt }).from(tickets).where(eq(tickets.id, ticketId)).limit(1)
  const result: ScanResultKind = cur?.status === 'used' ? 'already_used' : cur?.status === 'cancelled' ? 'cancelled' : cur?.status === 'refunded' ? 'refunded' : 'suspended'
  const [first] = await db.select({ gate: checkIns.gate, at: checkIns.scannedAt }).from(checkIns).where(and(eq(checkIns.ticketId, ticketId), eq(checkIns.result, 'accepted'))).limit(1)
  await record(result, ticketId, i.source === 'offline' && result === 'already_used')
  return { result, ticket: info, previous: result === 'already_used' ? { at: cur?.usedAt ?? first?.at ?? null, gate: first?.gate ?? null } : undefined, eventTitle: row.e.title }
}

/** Pack hors ligne : empreintes (pas de secret) + catégorie. À durée de vie limitée côté client. */
export async function buildOfflinePack(db: Db, eventId: string, secret?: string) {
  const rows = await db.select({ id: tickets.id, ref: tickets.ref, v: tickets.qrVersion, cat: ticketCategories.name, vip: ticketCategories.vip }).from(tickets).innerJoin(ticketCategories, eq(ticketCategories.id, tickets.categoryId)).where(and(eq(tickets.eventId, eventId), eq(tickets.status, 'valid')))
  return rows.map((r) => ({ d: offlineDigest(signTicketCode(r.id, r.v, secret)), r: r.ref, c: r.cat, vip: r.vip }))
}
export interface OfflineScan { digest: string; scannedAt: Date; gate: string }
/** Synchronisation : rejoue les scans dans l'ordre horaire avec la même règle atomique. Les doublons inter-appareils sont signalés (conflict = true). */
export async function syncOfflineScans(db: Db, p: { eventId: string; deviceId: string; userId: string | null; scans: OfflineScan[]; secret?: string }) {
  const rows = await db.select({ id: tickets.id, v: tickets.qrVersion }).from(tickets).where(eq(tickets.eventId, p.eventId))
  const byDigest = new Map(rows.map((r) => [offlineDigest(signTicketCode(r.id, r.v, p.secret)), r]))
  let accepted = 0, conflicts = 0
  const results: { digest: string; result: ScanResultKind }[] = []
  for (const s of [...p.scans].sort((a, b) => a.scannedAt.getTime() - b.scannedAt.getTime())) {
    const t = byDigest.get(s.digest)
    const input: ScanInput = { eventId: p.eventId, code: '', gate: s.gate, agentId: p.userId, deviceId: p.deviceId, source: 'offline', scannedAt: s.scannedAt }
    const record = (result: ScanResultKind, ticketId: string | null, conflict = false) => db.insert(checkIns).values({ eventId: p.eventId, ticketId, result, gate: s.gate, agentId: p.userId, deviceId: p.deviceId, source: 'offline', conflict, scannedAt: s.scannedAt })
    const out = t ? await scanTicket(db, input, t.id, t.v, s.scannedAt, record) : (await record('invalid', null), { result: 'invalid' as ScanResultKind })
    if (out.result === 'accepted') accepted++; else conflicts++
    results.push({ digest: s.digest, result: out.result })
  }
  await db.insert(offlineScanSyncs).values({ eventId: p.eventId, deviceId: p.deviceId, userId: p.userId, scansCount: p.scans.length, accepted, conflicts })
  return { accepted, conflicts, results }
}
export const checkInCount = async (db: Db, eventId: string) => (await db.select({ n: sql<number>`count(*)::int` }).from(checkIns).where(and(eq(checkIns.eventId, eventId), eq(checkIns.result, 'accepted'))))[0]?.n ?? 0
