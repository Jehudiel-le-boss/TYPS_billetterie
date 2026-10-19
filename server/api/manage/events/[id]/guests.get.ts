import { desc, eq } from 'drizzle-orm'
import { api, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { guestLists, invitations } from '~~/server/db/schema'
export default api(async (e) => {
  const { event } = await requireEvent(e, uuidParam(e, 'id'), 'guest:manage')
  return useDb().select({ id: invitations.id, name: invitations.name, email: invitations.email, status: invitations.status, list: guestLists.name, kind: guestLists.kind, createdAt: invitations.createdAt }).from(invitations).innerJoin(guestLists, eq(guestLists.id, invitations.guestListId)).where(eq(invitations.eventId, event.id)).orderBy(desc(invitations.createdAt)).limit(1000)
})
