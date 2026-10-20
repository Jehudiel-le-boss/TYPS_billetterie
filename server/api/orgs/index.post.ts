import { z } from 'zod'
import { api, parseBody, limit } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { auditLogs, organizationMembers, organizations } from '~~/server/db/schema'
import { randomCode } from '~~/server/utils/crypto'

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'organisation'
export default api(async (e) => {
  const u = await requireUser(e)
  limit(e, 'org-create', 10, 3600_000, u.id)
  const b = await parseBody(e, z.object({ name: z.string().trim().min(2).max(100), currency: z.string().length(3).default('XOF') }))
  const db = useDb()
  const org = await db.transaction(async (tx) => {
    const [o] = await tx.insert(organizations).values({ name: b.name, slug: `${slugify(b.name)}-${randomCode(4).toLowerCase()}`, currency: b.currency }).returning()
    if (!o) throw new Error('Organization insert returned no row')
    await tx.insert(organizationMembers).values({ organizationId: o.id, userId: u.id, role: 'owner' })
    await tx.insert(auditLogs).values({ actorId: u.id, organizationId: o.id, action: 'org.create', entityType: 'organization', entityId: o.id })
    return o!
  })
  return org
})
