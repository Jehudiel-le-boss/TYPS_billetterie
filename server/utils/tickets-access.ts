import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { tickets } from '../db/schema'
import { useDb } from './db'
import { fail } from './errors'
import { requireOrderAccess } from './orders'
import { requireEvent } from './access'

export async function requireTicketAccess(e: H3Event, ticketId: string) {
  const [t] = await useDb().select().from(tickets).where(eq(tickets.id, ticketId)).limit(1)
  if (!t) return fail(404, 'Billet introuvable', 'not_found')
  if (t.orderId) await requireOrderAccess(e, t.orderId)
  else await requireEvent(e, t.eventId, 'sales:read')
  return t
}
