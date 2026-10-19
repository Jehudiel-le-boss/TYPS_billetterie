import { desc } from 'drizzle-orm'
import { api } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requirePlatformAdmin } from '~~/server/utils/session'
import { auditLogs } from '~~/server/db/schema'
export default api(async (e) => { await requirePlatformAdmin(e); return useDb().select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200) })
