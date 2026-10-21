import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { api, parseBody, uuidParam } from '~~/server/utils/api'
import { useDb } from '~~/server/utils/db'
import { requireEvent } from '~~/server/utils/access'
import { eventStaff, users } from '~~/server/db/schema'
import { emailSchema } from '~~/shared/validation'
import { fail } from '~~/server/utils/errors'
import { audit } from '~~/server/utils/audit'
import { notifyUsers } from '~~/server/services/notifications'
import { sendEmail, mailLayout } from '~~/server/services/mail'
import { env } from '~~/server/utils/env'
export default api(async (e) => {
  const { user, event } = await requireEvent(e, uuidParam(e, 'id'), 'staff:manage')
  const b = await parseBody(e, z.object({ email: emailSchema, canScan: z.boolean().default(true), canSell: z.boolean().default(false), gates: z.array(z.string().max(40)).max(10).default([]) }).refine((value) => value.canScan || value.canSell, { message: 'Accordez au moins un droit à cet agent.', path: ['canScan'] }))
  const db = useDb()
  const [t] = await db.select({ id: users.id, email: users.email }).from(users).where(sql`lower(${users.email}) = ${b.email} AND ${users.deletedAt} IS NULL`).limit(1)
  if (!t) return fail(404, 'Aucun compte TYPS avec cette adresse : l’agent doit d’abord s’inscrire', 'no_account')
  await db.insert(eventStaff).values({ eventId: event.id, userId: t.id, canScan: b.canScan, canSell: b.canSell, gates: b.gates }).onConflictDoUpdate({ target: [eventStaff.eventId, eventStaff.userId], set: { canScan: b.canScan, canSell: b.canSell, gates: b.gates, revokedAt: null } })
  await audit(db, { actorId: user.id, organizationId: event.organizationId, action: 'staff.grant', entityType: 'user', entityId: t.id, meta: { eventId: event.id, ...b } })
  const workspacePath = `/app/events/${event.id}${b.canSell ? '?tab=guichet' : ''}`
  const workspaceUrl = `${env.siteUrl()}${workspacePath}`
  try {
    await notifyUsers(db, [{ userId: t.id, kind: 'event_staff', title: `Affectation : ${event.title}`, body: 'Vous avez reçu un accès à cet événement. Connectez-vous pour ouvrir votre espace et retrouver les outils autorisés.', href: workspacePath }])
  } catch (error) {
    console.error('[event-staff.notification] Could not create assignment notification', { errorName: error instanceof Error ? error.name : 'UnknownError' })
  }
  let emailSent = false
  let emailError = false
  try {
    emailSent = await sendEmail(db, t.email, `Votre affectation : ${event.title}`, mailLayout('Vous êtes affecté à un événement', 'Connectez-vous à TYPS pour retrouver cet événement dans votre espace et accéder aux outils qui vous ont été accordés.', { label: 'Ouvrir mon espace événement', url: workspaceUrl }))
  } catch (error) {
    emailError = true
    console.error('[event-staff.email] Could not send assignment link', { errorName: error instanceof Error ? error.name : 'UnknownError' })
  }
  return { ok: true, emailSent, emailError, workspaceUrl }
})
