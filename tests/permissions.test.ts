import { describe, expect, it } from 'vitest'
import { can, eventCan } from '../shared/permissions'
describe('permissions', () => {
  it('matrice des rôles', () => {
    expect(can('owner', 'org:manage')).toBe(true); expect(can('manager', 'org:manage')).toBe(false)
    expect(can('agent', 'scan')).toBe(true); expect(can('agent', 'sales:read')).toBe(false); expect(can('agent', 'event:write')).toBe(false)
    expect(can('seller', 'sales:create_physical')).toBe(true); expect(can('seller', 'sales:cancel')).toBe(false); expect(can('viewer', 'scan')).toBe(false); expect(can(null, 'event:read')).toBe(false)
  })
  it('affectation d’événement : droits limités', () => {
    const a = { platformAdmin: false, orgRole: null, staff: { canScan: true, canSell: false } }
    expect(eventCan(a, 'scan')).toBe(true); expect(eventCan(a, 'sales:create_physical')).toBe(false); expect(eventCan(a, 'stats:read')).toBe(false)
    expect(eventCan({ ...a, staff: null }, 'scan')).toBe(false)
  })
})
