// Données de DÉMONSTRATION (isolées : events.is_demo = true, paiements « demo », jamais FedaPay). Refusé en production.
import { sql } from 'drizzle-orm'
import { useDb, schema } from '../server/utils/db'
import { hashPassword, randomToken } from '../server/utils/crypto'
import { createOnlineOrder, settleOrderPaid } from '../server/services/checkout'
import { ZERO_FEES } from '../shared/money'
import { defaultLayout } from '../shared/template'

if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== 'yes') { console.error('Seed de démonstration refusé en production.'); process.exit(1) }
const db = useDb()
const { users, userProfiles, organizations, organizationMembers, events, eventLocations, ticketCategories, ticketTemplates, platformSettings } = schema

const demoEmail = 'demo@typs.invalid', agentEmail = 'agent@typs.invalid'
const pw = process.env.SEED_PASSWORD ?? 'DemoTyps2026!'
const upsertUser = async (email: string, name: string) => {
  const [ex] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1)
  if (ex) return ex.id
  const [u] = await db.insert(users).values({ email, passwordHash: await hashPassword(pw), emailVerifiedAt: new Date() }).returning()
  await db.insert(userProfiles).values({ userId: u!.id, fullName: name }); return u!.id
}
const ownerId = await upsertUser(demoEmail, 'Organisateur Démo'); await upsertUser(agentEmail, 'Agent Démo')
const [existing] = await db.select().from(organizations).where(sql`${organizations.slug} = 'demo-organisation'`).limit(1)
if (existing) { console.log('Données de démonstration déjà présentes.'); process.exit(0) }
const [org] = await db.insert(organizations).values({ name: 'Collectif Démo', slug: 'demo-organisation' }).returning()
await db.insert(organizationMembers).values({ organizationId: org!.id, userId: ownerId, role: 'owner' })
const [tpl] = await db.insert(ticketTemplates).values({ organizationId: org!.id, name: 'Néon classique', draftLayout: defaultLayout() }).returning()
const day = 86400_000
const defs = [
  { title: 'Lagune Live Festival (démo)', category: 'festival', slug: 'lagune-live-demo', in: 40, theme: 'festival', venue: 'Plage de démonstration', city: 'Cotonou', cap: 800, cats: [['Early bird', 'early_bird', 8000, 100, false], ['Standard', 'standard', 12000, 500, false], ['VIP', 'vip', 30000, 120, true], ['Backstage', 'backstage', 60000, 20, true]] },
  { title: 'Nuit Afro Vibes (démo)', category: 'soirée', slug: 'nuit-afro-vibes-demo', in: 12, theme: 'afro-vibes', venue: 'Club Équinoxe', city: 'Porto-Novo', cap: 300, cats: [['Entrée', 'standard', 5000, 250, false], ['Table VIP', 'vip', 50000, 20, true]] },
  { title: 'Conférence Tech Bénin (démo)', category: 'conférence', slug: 'conf-tech-demo', in: 25, theme: 'corporate-pro', venue: 'Palais des Congrès', city: 'Cotonou', cap: 500, cats: [['Gratuit', 'free', 0, 200, false], ['Pass pro', 'standard', 15000, 250, false]] }
] as const
for (const d of defs) {
  const [ev] = await db.insert(events).values({ organizationId: org!.id, slug: d.slug, title: d.title, description: `Événement de démonstration TYPS — ${d.title}. Les billets sont fictifs et les paiements simulés.`, category: d.category, status: 'published', shareToken: randomToken(12), startsAt: new Date(Date.now() + d.in * day), endsAt: new Date(Date.now() + d.in * day + 6 * 3600_000), capacity: d.cap, themeId: d.theme, isDemo: true, templateId: tpl!.id, offlineEnabled: true, transfersEnabled: true, accessTerms: 'Pièce d’identité requise. Billet strictement personnel.' }).returning()
  await db.insert(eventLocations).values({ eventId: ev!.id, venueName: d.venue, city: d.city })
  const cats = await db.insert(ticketCategories).values(d.cats.map((c, i) => ({ eventId: ev!.id, name: c[0], kind: c[1] as 'standard', price: c[2], quota: c[3], vip: c[4], position: i }))).returning()
  const people = ['Aïcha Dossou', 'Koffi Mensah', 'Fatou Diallo', 'Yaovi Agbessi', 'Chantal Hounkpatin', 'Rodrigue Sossou']
  for (const [i, p] of people.entries()) {
    const cat = cats[i % cats.length]!
    const o = await createOnlineOrder(db, { eventId: ev!.id, items: [{ categoryId: cat.id, quantity: 1 + (i % 2) }], buyer: { name: p, email: `${p.split(' ')[0]!.toLowerCase()}@demo.typs.invalid` }, demo: true }, ZERO_FEES)
    await settleOrderPaid(db, o.orderId, { provider: 'demo', amount: o.total, currency: o.currency, raw: { demo: true } })
  }
}
if (process.env.BOOTSTRAP_ADMIN_EMAIL) {
  const r = await db.update(users).set({ platformRole: 'admin' }).where(sql`lower(${users.email}) = ${process.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()}`).returning({ id: users.id })
  console.log(r.length ? 'Administrateur plateforme promu.' : 'BOOTSTRAP_ADMIN_EMAIL : compte introuvable (inscrivez-vous d’abord).')
}
await db.insert(platformSettings).values({ key: 'fees', value: ZERO_FEES }).onConflictDoNothing()
console.log(`Démo prête. Connexion : ${demoEmail} / ${pw}  (agent : ${agentEmail})`)
process.exit(0)
