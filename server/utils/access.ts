import { and, eq, isNull } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { events, organizationMembers, eventStaff } from '../db/schema'
import { useDb, type Db } from './db'
import { fail } from './errors'
import { requireUser, type SessionUser } from './session'
import { eventCan, can, type EventAccess, type OrgRole, type Perm } from '../../shared/permissions'

export async function orgRoleOf(db: Db, userId: string, orgId: string): Promise<OrgRole | null> {
  const [m] = await db.select({ role: organizationMembers.role }).from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, orgId), isNull(organizationMembers.revokedAt))).limit(1)
  return m?.role ?? null
}
/** Contrôle d'accès côté serveur à une organisation. Toute route organisateur passe par ici. */
export async function requireOrg(e: H3Event, orgId: string, perm: Perm): Promise<{ user: SessionUser; role: OrgRole | null }> {
  const user = await requireUser(e)
  const role = await orgRoleOf(useDb(), user.id, orgId)
  if (user.platformRole === 'admin') return { user, role }
  if (!can(role, perm)) fail(role ? 403 : 404, role ? 'Permission insuffisante' : 'Organisation introuvable', 'forbidden')
  return { user, role }
}
export async function eventAccessOf(db: Db, user: SessionUser, eventId: string): Promise<{ event: typeof events.$inferSelect; access: EventAccess } | null> {
  const [event] = await db.select().from(events).where(and(eq(events.id, eventId), isNull(events.deletedAt))).limit(1)
  if (!event) return null
  const [orgRole, staffRow] = await Promise.all([
    orgRoleOf(db, user.id, event.organizationId),
    db.select().from(eventStaff).where(and(eq(eventStaff.eventId, eventId), eq(eventStaff.userId, user.id), isNull(eventStaff.revokedAt))).limit(1)
  ])
  const s = staffRow[0]
  return { event, access: { platformAdmin: user.platformRole === 'admin', orgRole, staff: s ? { canScan: s.canScan, canSell: s.canSell } : null } }
}
export async function requireEvent(e: H3Event, eventId: string, perm: Perm) {
  const user = await requireUser(e)
  const found = await eventAccessOf(useDb(), user, eventId)
  // Hors périmètre : 404 (aucune fuite d'existence entre organisations).
  if (!found || !eventCan(found.access, 'event:read')) return fail(404, 'Événement introuvable', 'not_found')
  if (!eventCan(found.access, perm)) return fail(403, 'Permission insuffisante', 'forbidden')
  return { user, event: found.event, access: found.access }
}
