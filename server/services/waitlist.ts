import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { events, ticketCategories, waitlistEntries } from '../db/schema'
import type { Db } from '../utils/db'
import { sendEmail, mailLayout } from './mail'
import { env } from '../utils/env'

/** Libération contrôlée : on prévient dans l'ordre d'inscription tant qu'il y a plus de places libres que de personnes déjà prévenues. Pas de réservation de place (premier arrivé, premier servi). */
export async function releaseWaitlist(db: Db, now = new Date()): Promise<number> {
  const cats = await db.select({ c: ticketCategories, slug: events.slug, title: events.title }).from(ticketCategories).innerJoin(events, eq(events.id, ticketCategories.eventId)).where(and(isNull(ticketCategories.deletedAt), eq(events.status, 'published'), sql`${ticketCategories.quota} - ${ticketCategories.sold} - ${ticketCategories.reserved} > 0`))
  let n = 0
  for (const { c, slug, title } of cats) {
    const free = c.quota - c.sold - c.reserved
    await db.update(waitlistEntries).set({ status: 'expired' }).where(and(eq(waitlistEntries.categoryId, c.id), eq(waitlistEntries.status, 'offered'), sql`${waitlistEntries.offerExpiresAt} < ${now}`))
    const [{ pending }] = await db.select({ pending: sql<number>`count(*)::int` }).from(waitlistEntries).where(and(eq(waitlistEntries.categoryId, c.id), eq(waitlistEntries.status, 'offered'))) as [{ pending: number }]
    const waiting = await db.select().from(waitlistEntries).where(and(eq(waitlistEntries.categoryId, c.id), eq(waitlistEntries.status, 'waiting'))).orderBy(asc(waitlistEntries.createdAt)).limit(Math.max(0, free - pending))
    for (const w of waiting) {
      await db.update(waitlistEntries).set({ status: 'offered', offerExpiresAt: new Date(now.getTime() + 30 * 60_000) }).where(eq(waitlistEntries.id, w.id))
      void sendEmail(db, w.email, `Une place s’est libérée : ${title}`, mailLayout('Une place est disponible', `Des billets « ${c.name} » sont de nouveau en vente pour ${title}. Vous avez 30 minutes de priorité d’information ; les places partent au premier paiement.`, { label: 'Acheter maintenant', url: `${env.siteUrl()}/events/${slug}` }))
      n++
    }
  }
  return n
}
