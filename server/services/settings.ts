import { eq } from 'drizzle-orm'
import { platformSettings } from '../db/schema'
import type { Db } from '../utils/db'
import { ZERO_FEES, type FeeConfig } from '../../shared/money'
import { audit } from '../utils/audit'

export async function getFeeConfig(db: Db): Promise<FeeConfig> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, 'fees')).limit(1)
  return { ...ZERO_FEES, ...((row?.value as Partial<FeeConfig>) ?? {}) }
}
export async function setFeeConfig(db: Db, actorId: string, value: FeeConfig, ip?: string) {
  const before = await getFeeConfig(db)
  await db.insert(platformSettings).values({ key: 'fees', value, updatedBy: actorId }).onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: actorId, updatedAt: new Date() } })
  await audit(db, { actorId, action: 'settings.fees.update', entityType: 'platform_settings', entityId: 'fees', meta: { before, after: value }, ip })
}
