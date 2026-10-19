import { describe, expect, it } from 'vitest'
import { rateLimitCheck } from '../server/utils/rate-limit'
describe('limiteur', () => { it('bloque après le seuil puis libère', () => { const k = `t${Math.random()}`; for (let i = 0; i < 3; i++) expect(rateLimitCheck(k, 3, 1000, 1000).ok).toBe(true); expect(rateLimitCheck(k, 3, 1000, 1500).ok).toBe(false); expect(rateLimitCheck(k, 3, 1000, 2500).ok).toBe(true) }) })
