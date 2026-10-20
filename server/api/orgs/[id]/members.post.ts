import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireOrg } from '~~/server/utils/access'
import { organizationMembers, organizations, users } from '~~/server/db/schema'
import { emailSchema } from '~~/shared/validation'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
import { notifyUsers } from '~~/server/services/notifications'
export default api(async (e) => {
  const orgId = uuidParam(e, 'id'); const { user } = await requireOrg(e, orgId, 'staff:manage')
  const b = await parseBody(e, z.object({ email: emailSchema, role: z.enum(['manager', 'seller', 'agent', 'viewer']) }))
  const db = useDb()
  const [target] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${b.email} AND ${users.deletedAt} IS NULL`).limit(1)
  if (!target) fail(404, 'Aucun compte TYPS avec cette adresse : la personne doit d’abord s’inscrire', 'no_account')
  await db.insert(organizationMembers).values({ organizationId: orgId, userId: target!.id, role: b.role }).onConflictDoUpdate({ target: [organizationMembers.organizationId, organizationMembers.userId], set: { role: b.role, revokedAt: null } })
  const [organization] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1)
  await notifyUsers(db, [{ userId: target!.id, kind: 'team_role', title: 'Accès à une organisation', body: `Tu as été ajouté à ${organization?.name ?? 'une organisation'} avec le rôle ${b.role}.`, href: '/app' }])
  await audit(db, { actorId: user.id, organizationId: orgId, action: 'org.member.set', entityType: 'user', entityId: target!.id, meta: { role: b.role } })
  return { ok: true }
})
