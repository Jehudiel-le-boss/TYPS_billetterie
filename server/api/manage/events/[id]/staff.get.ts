import { and, eq, isNull } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { eventStaff, users, userProfiles } from '~~/server/db/schema'
export default api(async (e) => {
  const { event } = await requireEvent(e, uuidParam(e, 'id'), 'staff:manage')
  return useDb().select({ id: eventStaff.id, userId: users.id, email: users.email, name: userProfiles.fullName, canScan: eventStaff.canScan, canSell: eventStaff.canSell, gates: eventStaff.gates }).from(eventStaff).innerJoin(users, eq(users.id, eventStaff.userId)).leftJoin(userProfiles, eq(userProfiles.userId, users.id)).where(and(eq(eventStaff.eventId, event.id), isNull(eventStaff.revokedAt)))
})
