import type { H3Event } from 'h3'
import type { PlatformFeature } from '../../shared/platform-features'
import { useDb } from './db'
import { fail } from './errors'
import { isPlatformFeatureEnabled } from '../services/settings'

export async function requirePlatformFeature(e: H3Event, feature: PlatformFeature) {
  if (!(await isPlatformFeatureEnabled(useDb(), feature))) fail(503, 'Cette fonctionnalité est temporairement désactivée par TYPS', 'feature_disabled')
}
