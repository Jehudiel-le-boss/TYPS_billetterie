# TYPS — Ton événement. Ton ticket. Ton contrôle.

Plateforme de billetterie événementielle (Bénin & Afrique francophone, FCFA/XOF) : création d'événements, **éditeur visuel de billets**, vente en ligne via **FedaPay**, **ventes au guichet**, **scanner anti-fraude** (QR signés, validation atomique côté serveur), statistiques réelles, administration plateforme.

**Stack** : Nuxt 3 (Nitro, SSR) · Vue 3 · TypeScript strict · Tailwind · Motion for Vue (`motion-v`) · TresJS/Three.js (hero 3D uniquement) · Neon PostgreSQL + Drizzle ORM · FedaPay (SDK officiel `fedapay`) · stockage S3 (URLs signées) · Zod · pdf-lib · qrcode · Resend (e-mails).

## Prérequis
Node ≥ 20.11 (22 recommandé), npm, un projet **Neon** (ou le PostgreSQL local de `docker-compose.yml` pour développer), et selon les fonctions : compte marchand FedaPay (sandbox), bucket S3/R2, clé Resend. Voir `.env.example`.

## Installation rapide
```bash
npm ci
cp .env.example .env        # renseigner DATABASE_URL, SESSION_SECRET, QR_SECRET, CRON_SECRET
npm run db:migrate          # migrations Drizzle versionnées (server/db/migrations)
DEMO_MODE=true APP_ENV=development npm run db:seed   # données de démonstration (facultatif, refusé en production)
npm run dev                 # http://localhost:3000
```
Sans Neon : `docker compose up -d` puis `DATABASE_URL=postgres://typs:typs@localhost:5432/typs`.
Comptes de démo (seed) : `demo@typs.invalid` / `DemoTyps2026!` (organisateur) et `agent@typs.invalid`. Pour devenir administrateur : inscrivez-vous puis `BOOTSTRAP_ADMIN_EMAIL=vous@exemple.com npm run db:seed`.

## Commandes
| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `preview` | développement, build Nitro, prévisualisation |
| `npm run typecheck` | `nuxt typecheck` (vue-tsc, TypeScript strict) |
| `npm run lint` | ESLint (TS + Vue) |
| `npm test` | Vitest : unitaires + intégration sur un vrai PostgreSQL embarqué (PGlite, mêmes migrations) |
| `npm run check` | typecheck + lint + tests + build |
| `npm run db:generate` | génère une migration depuis `server/db/schema.ts` |
| `npm run db:migrate` | applique les migrations (Neon ou PostgreSQL local) |
| `npm run db:seed` | données de démonstration (`is_demo = true`) |
| `npm run db:expire-holds` | libère les réservations expirées (équivalent du cron HTTP) |
| `node scripts/smoke.mjs` | test de fumée HTTP contre une instance (`BASE=http://localhost:3000`) |

## Architecture
```
shared/        thèmes (16 + personnalisés par événement), montants entiers, permissions, gabarit de billet, validation Zod — partagés client/serveur
server/db/     schema.ts (Drizzle) + migrations/
server/utils/  env, crypto (scrypt, HMAC), QR signés, sessions, contrôle d'accès, rate-limit, audit
server/services/  checkout (quota atomique), scan (anti-doublon), fedapay, payments, pdf, ticket-render, storage, mail, csv, guests, waitlist
server/api/    routes REST : auth, orgs, events, manage/*, checkout, orders, tickets, scan, templates, uploads, admin, webhooks, internal/cron, health
pages/ layouts/ components/ composables/   interface (public, /app organisateur, /scan agent, /admin)
tests/         unitaires + intégration (PGlite)   scripts/  migrate, seed, expire-holds, smoke
```
Principes clés : montants en **entiers** ; quota garanti par `UPDATE … WHERE sold + reserved + qty <= quota` + verrou d'événement + `CHECK` SQL ; billet = `UPDATE … WHERE status='valid'` (un seul scan gagne) ; **le QR ne contient qu'une référence signée HMAC** ; le paiement n'est jamais cru sur la redirection (relecture FedaPay serveur-à-serveur).

Les descriptions d'événements utilisent un éditeur Tiptap accessible (titres, listes, liens, couleurs, alignement, historique et collage nettoyé). Les FAQ sont réordonnables à la création et à l'édition; les calques du Studio de billets sont également réordonnables. Ces listes utilisent VueDraggable/SortableJS avec des commandes clavier de déplacement pour les FAQ.

## Guides de démarrage
La première visite publique propose un tour facultatif, avec progression, navigation clavier et option pour passer. Après inscription, le parcours choisi (acheteur, organisateur ou agent) lance une aide contextualisée; les rôles d’équipe et leurs permissions restent attribués par les organisateurs, indépendamment de ce choix. Le bouton d’aide flottant permet de rejouer la découverte, un parcours spécifique ou le guide complet. L’état « déjà vu » et le parcours choisi sont conservés dans le stockage local du navigateur.

## Fonctionnalités : état réel
Voir la section « État de livraison » du message de livraison et `SECURITY.md`. Fonctions **prévues mais désactivées** (non simulées) : abonnements payants/facturation, API publique, webhooks sortants, marque blanche, marketplace de modèles, WhatsApp, remboursement automatique via l'API FedaPay.

## Dépannage
- `DATABASE_URL manquante` : définir la variable (les secrets sont lus à l'exécution, pas au build).
- `Variable … manquante en production` : `SESSION_SECRET` / `QR_SECRET` (≥ 16 caractères) sont obligatoires hors `APP_ENV=development`.
- Mode démo refusé : il est impossible en production (`APP_ENV` vide ou `production`).
- `FedaPay n'est pas configuré` : renseigner `FEDAPAY_SECRET_KEY_SANDBOX` (+ `FEDAPAY_WEBHOOK_SECRET_SANDBOX`).
- Uploads : sans `S3_BUCKET`, stockage disque `.data/uploads` (développement seulement).
- Caméra du scanner : exige HTTPS (ou localhost) et l'autorisation du navigateur.
