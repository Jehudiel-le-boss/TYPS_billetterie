import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '../server/db/schema'
import type { Db } from '../server/utils/db'
import { randomToken } from '../server/utils/crypto'

/** Vraie base PostgreSQL embarquée (PGlite) + les vraies migrations : teste les contraintes, verrous et UPDATE atomiques réels. */
export async function makeDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema })
  await migrate(db, { migrationsFolder: './server/db/migrations' })
  return db as unknown as Db
}
export async function fixture(db: Db, o: { quota?: number; capacity?: number; price?: number; status?: 'published' | 'draft' } = {}) {
  const [user] = await db.insert(schema.users).values({ email: `u${randomToken(4)}@t.io`, passwordHash: 'x' }).returning()
  const [org] = await db.insert(schema.organizations).values({ name: 'Org', slug: `org-${randomToken(4)}` }).returning()
  await db.insert(schema.organizationMembers).values({ organizationId: org!.id, userId: user!.id, role: 'owner' })
  const [ev] = await db.insert(schema.events).values({ organizationId: org!.id, slug: `ev-${randomToken(4)}`, title: 'Fête', shareToken: randomToken(8), startsAt: new Date(Date.now() + 5 * 86400_000), capacity: o.capacity ?? 100, status: o.status ?? 'published', maxPerOrder: 10 }).returning()
  const [cat] = await db.insert(schema.ticketCategories).values({ eventId: ev!.id, name: 'Standard', price: o.price ?? 5000, quota: o.quota ?? 10 }).returning()
  return { user: user!, org: org!, ev: ev!, cat: cat! }
}
export const buyer = (n = 1) => ({ name: `Client ${n}`, email: `c${n}@t.io` })
