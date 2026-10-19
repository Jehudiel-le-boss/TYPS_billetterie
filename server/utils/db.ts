import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import pg from 'pg'
import ws from 'ws'
import * as schema from '../db/schema'
import { env } from './env'

export type Db = PgDatabase<any, typeof schema>
export { schema }
let _db: Db | null = null
/** Neon (WebSocket serverless) par défaut. Pour un PostgreSQL local (Docker/CI), une URL non-Neon bascule sur le pilote TCP `pg`. */
export const isNeonUrl = (url: string) => /neon\.(tech|build)/.test(url)
export function useDb(): Db {
  if (_db) return _db
  const url = env.databaseUrl()
  if (isNeonUrl(url)) {
    if (typeof WebSocket === 'undefined') neonConfig.webSocketConstructor = ws
    _db = drizzleNeon(new NeonPool({ connectionString: url, max: 10 }), { schema }) as unknown as Db
  } else {
    _db = drizzlePg(new pg.Pool({ connectionString: url, max: 10 }), { schema }) as unknown as Db
  }
  return _db
}
