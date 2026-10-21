import { and, eq } from 'drizzle-orm'
import { ticketTemplateAssets } from '../db/schema'
import type { Db } from '../utils/db'

export async function organizationAsset(db: Db, organizationId: string, storageKey: string, kind: string) {
  const [asset] = await db.select({ id: ticketTemplateAssets.id }).from(ticketTemplateAssets).where(and(
    eq(ticketTemplateAssets.organizationId, organizationId),
    eq(ticketTemplateAssets.storageKey, storageKey),
    eq(ticketTemplateAssets.kind, kind)
  )).limit(1)
  return asset ?? null
}
