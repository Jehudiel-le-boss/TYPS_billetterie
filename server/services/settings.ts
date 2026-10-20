import { eq } from 'drizzle-orm'
import { platformSettings } from '../db/schema'
import type { Db } from '../utils/db'
import { ZERO_FEES, type FeeConfig } from '../../shared/money'
import { DEFAULT_PLATFORM_FEATURES, type PlatformFeature, type PlatformFeatureFlags } from '../../shared/platform-features'
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

export async function getPlatformFeatures(db: Db): Promise<PlatformFeatureFlags> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, 'features')).limit(1)
  return { ...DEFAULT_PLATFORM_FEATURES, ...((row?.value as Partial<PlatformFeatureFlags>) ?? {}) }
}

export async function isPlatformFeatureEnabled(db: Db, feature: PlatformFeature): Promise<boolean> {
  return (await getPlatformFeatures(db))[feature]
}

export async function setPlatformFeatures(db: Db, actorId: string, value: PlatformFeatureFlags, ip?: string) {
  const before = await getPlatformFeatures(db)
  await db.insert(platformSettings).values({ key: 'features', value, updatedBy: actorId }).onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: actorId, updatedAt: new Date() } })
  await audit(db, { actorId, action: 'settings.features.update', entityType: 'platform_settings', entityId: 'features', meta: { before, after: value }, ip })
}
