import { and, eq, isNull } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { ticketTemplates } from '../db/schema'
import { useDb } from './db'
import { fail } from './errors'
import { requireOrg } from './access'
import type { Perm } from '../../shared/permissions'
export async function requireTemplate(e: H3Event, id: string, perm: Perm) {
  const [t] = await useDb().select().from(ticketTemplates).where(and(eq(ticketTemplates.id, id), isNull(ticketTemplates.deletedAt))).limit(1)
  if (!t) return fail(404, 'Modèle introuvable', 'not_found')
  const { user } = await requireOrg(e, t.organizationId, perm)
  return { user, template: t }
}
