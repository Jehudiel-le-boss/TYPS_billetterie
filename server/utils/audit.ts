import { auditLogs } from '../db/schema'
import type { Db } from './db'
export interface AuditInput { actorId?: string | null; organizationId?: string | null; action: string; entityType?: string; entityId?: string; meta?: Record<string, unknown>; ip?: string }
export async function audit(db: Db, a: AuditInput) {
  await db.insert(auditLogs).values({ actorId: a.actorId ?? null, organizationId: a.organizationId ?? null, action: a.action, entityType: a.entityType, entityId: a.entityId, meta: a.meta ?? null, ip: a.ip })
}
