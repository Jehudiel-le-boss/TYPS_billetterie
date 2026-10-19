// Applique les migrations Drizzle versionnées : `npm run db:migrate` (DATABASE_URL requis : Neon en production).
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless'
import { migrate as migrateNeon } from 'drizzle-orm/neon-serverless/migrator'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import ws from 'ws'
const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL manquante'); process.exit(1) }
const folder = './server/db/migrations'
if (/neon\.(tech|build)/.test(url)) {
  neonConfig.webSocketConstructor = ws
  const pool = new NeonPool({ connectionString: url }); await migrateNeon(drizzleNeon(pool), { migrationsFolder: folder }); await pool.end()
} else {
  const pool = new pg.Pool({ connectionString: url }); await migratePg(drizzlePg(pool), { migrationsFolder: folder }); await pool.end()
}
console.log('Migrations appliquées.')
