# DATABASE — Neon PostgreSQL (Drizzle)

Base exclusivement **Neon PostgreSQL** en production. Pilote : `@neondatabase/serverless` (WebSocket) via `drizzle-orm/neon-serverless` (transactions interactives, `SELECT … FOR UPDATE`). Pour le développement local/CI, une `DATABASE_URL` qui n'est pas `*.neon.tech|build` bascule sur le pilote TCP `pg` (même schéma, mêmes migrations).

Source de vérité : `server/db/schema.ts` · migrations versionnées : `server/db/migrations/` (générées par `drizzle-kit generate`, appliquées par `npm run db:migrate`). Horodatages `timestamptz` (UTC). Montants : `integer` (unité mineure ; XOF sans décimales) — jamais de flottants.

## Tables (37)
**Comptes** `users` (e-mail unique insensible à la casse, `platform_role` user/admin, suppression logique), `user_profiles`, `sessions` (jeton haché SHA-256, révocable), `auth_tokens` (vérification e-mail / reset, hachés, usage unique).
**Organisations** `organizations`, `organization_members` (un utilisateur ↔ plusieurs organisations, rôle par organisation : owner/manager/seller/agent/viewer), `organization_invitations` (préparée ; l'interface ajoute pour l'instant des comptes existants).
**Événements** `events` (statuts draft/published/suspended/closed/cancelled ; visibilité public/private/invite ; `share_token`, code d'accès haché ; modération ; `is_demo` ; FAQ et options de compte à rebours), `event_locations`, `ticket_categories` (quota, `sold`, `reserved`, fenêtres de vente/validité ; **CHECK `sold + reserved <= quota`**), `event_staff` (agents affectés à UN événement, révocation), `event_reports`.
**Modèles de billets** `ticket_templates` (brouillon JSON), `ticket_template_versions` (versions immuables publiées), `ticket_template_assets` (fichiers S3, type réel vérifié).
**Ventes** `orders` (canal online/physical/guest/import ; montants : sous-total, remise, frais acheteur, total, frais prestataire, commission plateforme, net organisateur ; `access_token_hash`), `order_items`, `payments` (fournisseur, id transaction, référence unique, statut, brut `raw`), `payment_webhook_events` (déduplication `dedupe_key` unique), `refunds`, `promo_codes`, `promo_code_redemptions`, `settlements`.
**Billets & contrôle** `ticket_batches`, `tickets` (`ref` unique imprimée, `qr_version`, statut valid/used/cancelled/refunded/suspended), `check_ins` (toute tentative de scan, résultat, porte, agent, appareil, `source` online/offline, `conflict`), `scanner_sessions`, `offline_scan_syncs`, `ticket_transfers`, `waitlist_entries`, `guest_lists`, `invitations` (invités).
**Exploitation** `notification_jobs`, `notification_logs`, `platform_settings` (frais), `audit_logs`.

## Écarts documentés vs. la liste du cahier des charges
| Demandé | Réalisé | Raison |
|---|---|---|
| `roles` / `permissions` | enum `org_role` + matrice dans `shared/permissions.ts` | Les permissions sont du code testé ; pas de table à désynchroniser. |
| `ticket_template_elements` | éléments en JSONB dans `ticket_template_versions.layout` / `ticket_templates.draft_layout` | Sauvegarde atomique d'un gabarit complet, versions immuables, même JSON pour éditeur et PDF. |
| `scanner_devices` ou `scanner_sessions` | `scanner_sessions` (+ `device_id` dans `check_ins`) | Table créée ; l'identification d'appareil passe par `device_id` du client. |
| — | `sessions`, `auth_tokens`, `event_reports` | Nécessaires à l'authentification, à la récupération de compte et aux signalements. |
| Réservations temporaires | compteur `reserved` + `orders.expires_at` (15 min) | Pas de table de holds : une seule UPDATE atomique ; libération par `expireHolds`. |

## Intégrité et concurrence
- **Quota** : `UPDATE ticket_categories SET reserved = reserved + :q WHERE … AND sold + reserved + :q <= quota` après un `SELECT … FOR UPDATE` sur l'événement (sérialise les réservations → capacité globale aussi respectée). Le `CHECK` SQL est un second filet.
- **Scan** : `UPDATE tickets SET status='used' … WHERE id=:id AND status='valid' AND qr_version=:v AND event_id=:e RETURNING` — une seule transaction gagne ; les autres lisent l'état et reçoivent « déjà utilisé ».
- **Paiement** : `settleOrderPaid` verrouille la commande (`FOR UPDATE`), vérifie montant + devise, déplace `reserved → sold`, émet les billets ; rejouable sans effet (statut `paid` → `already_paid`).
- **Idempotence** : `payment_webhook_events.dedupe_key` unique ; `payments.reference` unique ; `orders.idempotency_key` unique ; `promo_code_redemptions.order_id` unique.
- **Isolation** : toute route passe par `requireOrg` / `requireEvent` (contrôle côté serveur) ; un événement hors périmètre répond **404**.

## Conservation (règles explicites — à faire valider juridiquement)
Jamais supprimés physiquement : `orders`, `order_items`, `payments`, `payment_webhook_events`, `refunds`, `settlements`, `audit_logs`, `check_ins` (obligations comptables et preuve d'accès). Suppression logique (`deleted_at`) : `users`, `organizations`, `events`, `ticket_categories`, `ticket_templates`. Données personnelles minimales (nom, e-mail, téléphone facultatif) ; `sessions` expirées et `auth_tokens` utilisés peuvent être purgés périodiquement.

## Index utiles
`events(status, visibility, starts_at)`, `tickets(event_id, status)`, `tickets(order_id)`, `check_ins(event_id, scanned_at)`, `orders(event_id, status)`, `orders(status, expires_at)` (expiration), `payments(provider, provider_tx_id)` unique, `audit_logs(organization_id, created_at)`, etc. (voir le schéma).

## Migrations
```bash
# 1. modifier server/db/schema.ts
npm run db:generate        # crée server/db/migrations/000N_*.sql (à relire et committer)
npm run db:migrate         # applique sur DATABASE_URL
```
Migrations **avant** de basculer le trafic ; changements compatibles ascendants (ajout avant suppression) pour permettre un retour arrière applicatif.

## Sauvegarde / restauration
- **Neon (recommandé)** : *Point-in-time restore* et **branches** (copy-on-write). Avant toute migration risquée : créer une branche `pre-migration-AAAAMMJJ` depuis `main`. Restauration : *Restore* à un instant donné ou promotion de la branche. Régler la fenêtre de rétention selon le plan Neon.
- **Dump logique** (archivage hors Neon) — utiliser la connexion **directe** (non « pooled ») :
  ```bash
  pg_dump --format=custom --no-owner "$DATABASE_URL_DIRECT" -f typs-$(date +%F).dump
  pg_restore --clean --if-exists --no-owner -d "$TARGET_URL" typs-AAAA-MM-JJ.dump
  ```
- Tester la restauration sur une branche/base vierge au moins une fois avant la production ; stocker les dumps chiffrés hors de la base.
