export const ORG_ROLES = ['owner', 'manager', 'seller', 'agent', 'viewer'] as const
export type OrgRole = (typeof ORG_ROLES)[number]
export type Perm =
  | 'org:manage' | 'staff:manage' | 'event:write' | 'event:read' | 'template:write' | 'sales:read' | 'sales:create_physical'
  | 'sales:cancel' | 'scan' | 'stats:read' | 'finance:read' | 'refund:decide' | 'guest:manage' | 'promo:manage'

const ALL: Perm[] = ['org:manage', 'staff:manage', 'event:write', 'event:read', 'template:write', 'sales:read', 'sales:create_physical', 'sales:cancel', 'scan', 'stats:read', 'finance:read', 'refund:decide', 'guest:manage', 'promo:manage']
export const ROLE_PERMS: Record<OrgRole, Perm[]> = {
  owner: ALL,
  manager: ALL.filter((p) => p !== 'org:manage'),
  seller: ['event:read', 'sales:read', 'sales:create_physical', 'scan'],
  agent: ['event:read', 'scan'],
  viewer: ['event:read', 'sales:read', 'stats:read']
}
export const can = (role: OrgRole | null | undefined, perm: Perm) => !!role && ROLE_PERMS[role].includes(perm)

/** Affectation d'événement (event_staff) : permissions limitées à UN événement. */
export interface StaffGrant { canScan: boolean; canSell: boolean }
export interface EventAccess { platformAdmin: boolean; orgRole: OrgRole | null; staff: StaffGrant | null }
export function eventCan(a: EventAccess, perm: Perm): boolean {
  if (a.platformAdmin) return true
  if (can(a.orgRole, perm)) return true
  if (a.staff) {
    if (perm === 'scan' || perm === 'event:read') return a.staff.canScan || a.staff.canSell
    if (perm === 'sales:create_physical') return a.staff.canSell
  }
  return false
}
