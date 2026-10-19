import { and, eq } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { organizationMembers } from '~~/server/db/schema'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
export default api(async (e) => {
  const orgId = uuidParam(e, 'id'); const mid = uuidParam(e, 'mid'); const { user } = await requireOrg(e, orgId, 'staff:manage')
  const [m] = await useDb().update(organizationMembers).set({ revokedAt: new Date() }).where(and(eq(organizationMembers.id, mid), eq(organizationMembers.organizationId, orgId))).returning()
  if (!m) fail(404, 'Membre introuvable', 'not_found')
  if (m!.role === 'owner') { await useDb().update(organizationMembers).set({ revokedAt: null }).where(eq(organizationMembers.id, mid)); fail(409, 'Le propriétaire ne peut pas être retiré', 'conflict') }
  await audit(useDb(), { actorId: user.id, organizationId: orgId, action: 'org.member.revoke', entityType: 'member', entityId: mid })
  return { ok: true }
})
