# DEPLOYMENT — mise en production de TYPS

TYPS est une application **Nuxt 3 / Nitro** (preset `node-server`) : un serveur Node unique sert les pages SSR et l'API. Hébergeurs compatibles : Render (exemple fourni : `render.yaml`), Railway, Fly.io, VPS (systemd/PM2), tout hébergeur Node ≥ 20. Les identifiants ci-dessous **ne peuvent pas être fournis par le code** : ce sont les actions manuelles listées.

## 1. Préparer le projet
```bash
npm ci && npm run check      # typecheck + lint + tests + build
```
Le build produit `.output/` (démarrage : `node .output/server/index.mjs`, variable `PORT`).

## 2. Neon
1. Créer un projet Neon (région proche des utilisateurs). Copier la chaîne de connexion **pooled** → `DATABASE_URL` (`?sslmode=require`). Garder aussi la chaîne directe pour `pg_dump`.
2. Appliquer les migrations : `DATABASE_URL=… npm run db:migrate` (ou au démarrage, cf. `render.yaml`).
3. Ne **jamais** lancer `db:seed` en production (refusé par le script). Pour créer le premier administrateur : s'inscrire sur le site, puis `BOOTSTRAP_ADMIN_EMAIL=vous@domaine.com DATABASE_URL=… npm run db:seed` n'est pas recommandé en production → préférer SQL : `UPDATE users SET platform_role='admin' WHERE email='vous@domaine.com';`.

## 3. Variables d'environnement (voir `.env.example`)
Obligatoires : `DATABASE_URL` (pooler, runtime), `DATABASE_URL_UNPOOLED` (connexion directe, migrations), `NUXT_PUBLIC_SITE_URL` (URL publique HTTPS), `SESSION_SECRET`, `QR_SECRET`, `CRON_SECRET` (`openssl rand -base64 48`). Laisser `APP_ENV` **vide** (= production) et `DEMO_MODE` absent/`false`. Le serveur refuse de démarrer sans secrets valides.

## 4. Stockage des fichiers (S3-compatible)
Créer un bucket **privé** (Cloudflare R2, AWS S3, MinIO…) et un jeton d'accès limité à ce bucket. Renseigner `S3_ENDPOINT` (R2 : `https://<account>.r2.cloudflarestorage.com`), `S3_REGION` (`auto` pour R2), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Les fichiers sont servis par **URLs signées temporaires** ; aucun accès public. Sans `S3_BUCKET`, TYPS écrit sur le disque local (`.data/uploads`) : **à proscrire en production** (disque éphémère).

## 5. FedaPay
1. Créer un compte marchand FedaPay. **Sandbox d'abord** : `FEDAPAY_ENV=sandbox`, clé secrète sandbox dans `FEDAPAY_SECRET_KEY_SANDBOX`.
2. Tableau de bord FedaPay → Webhooks → créer un endpoint `https://VOTRE-DOMAINE/api/webhooks/fedapay`, abonné aux événements `transaction.*` (au minimum `transaction.approved`, `transaction.declined`, `transaction.canceled`) ; copier le **secret de l'endpoint** dans `FEDAPAY_WEBHOOK_SECRET_SANDBOX`. (Documentation : https://docs.fedapay.com — section Webhooks.)
3. Tester un paiement complet en sandbox (voir §9) : achat → paiement → webhook → billets émis.
4. **Passage en live** : activer le compte (KYC FedaPay), renseigner `FEDAPAY_SECRET_KEY_LIVE` et `FEDAPAY_WEBHOOK_SECRET_LIVE` (créer un endpoint webhook **live** distinct), puis `FEDAPAY_ENV=live`. Redéployer, refaire un achat réel de faible montant et vérifier la réception du webhook.
5. Frais : à saisir dans **Admin → Paiements & frais** (aucune valeur par défaut). Les frais réels FedaPay dépendent de votre contrat.
Remboursements et reversements : traités **manuellement** (suivi dans TYPS) — l'API de remboursement n'est pas utilisée.

## 5 bis. E-mails
Créer un compte Resend, vérifier le domaine d'envoi, renseigner `RESEND_API_KEY` et `MAIL_FROM`. Sans clé, les e-mails sont journalisés (`notification_logs`) mais non envoyés : les acheteurs gardent l'accès par le lien de la page de confirmation.

## 6. Domaine et HTTPS
Pointer le domaine (CNAME/A) vers l'hébergeur ; HTTPS automatique (Render, Fly, Cloudflare) ou Caddy/Nginx + Let's Encrypt sur VPS. HTTPS est **obligatoire** : cookies `Secure`, caméra du scanner, HSTS. Derrière un proxy, transmettre `X-Forwarded-For` / `X-Forwarded-Host`.

## 7. Build et lancement
```bash
npm ci && npm run build
node .output/server/index.mjs        # PORT=3000 par défaut
```
Cron (toutes les 5 min) : `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://VOTRE-DOMAINE/api/internal/cron` — libère les réservations expirées (après revérification FedaPay), envoie les rappels, prévient la liste d'attente.

## 7 bis. Déploiement Vercel (domaine TYPS actuel)
Le dépôt contient `vercel.json` : le build applique les migrations versionnées avec `DATABASE_URL_UNPOOLED`, puis construit Nuxt ; un cron appelle `/api/internal/cron` toutes les 5 minutes. Vercel transmet `Authorization: Bearer $CRON_SECRET`, accepté par cette route. Vérifier que le plan Vercel autorise cette fréquence.

Dans **Vercel → Settings → Environment Variables**, définir au minimum `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NUXT_PUBLIC_SITE_URL=https://typs-ashy.vercel.app`, `SESSION_SECRET`, `QR_SECRET`, `CRON_SECRET`, `FEDAPAY_ENV=sandbox`, `FEDAPAY_SECRET_KEY_SANDBOX` et `FEDAPAY_WEBHOOK_SECRET_SANDBOX`. Pour un lancement réel, ajouter aussi un bucket S3/R2 privé (`S3_BUCKET`, identifiants et région), `RESEND_API_KEY` et `MAIL_FROM`. Ne jamais copier le `.env` local dans le dépôt.

La route `/api/health` expose `ready` et les contrôles manquants sans révéler de secret. En production, `ready` reste faux tant que base, secrets, HTTPS, FedaPay/webhook, S3, e-mail et Neon Auth ne sont pas configurés/intégrés. Le disque local est refusé comme stockage de fichiers en production.

**Sauvegardes** : Neon fournit restauration temporelle/branches selon le plan. Vérifier la rétention active dans le tableau de bord, créer une branche avant les changements risqués et tester une restauration ; le code de l'application ne peut ni activer un plan Neon ni garantir une sauvegarde indépendante.

**Authentification Neon** : le code Nuxt actuel utilise encore ses routes de session et tables `users`/`sessions` applicatives ; il n'est pas encore connecté à Managed Better Auth (Neon Auth). L'URL d'authentification fournie par les réglages Neon et la stratégie de liaison des utilisateurs doivent être définies avant de présenter Neon Auth comme fournisseur actif. Pour la production Managed Better Auth, configurer aussi domaines approuvés, SMTP, vérification d'e-mail et désactivation de l'accès localhost (voir [la checklist officielle Neon](https://neon.com/docs/auth/production-checklist)).

**FedaPay webhook** : URL `https://typs-ashy.vercel.app/api/webhooks/fedapay`, vérification SSL activée, pas d'entêtes/corps personnalisés. Garder « recevoir tous les événements » ou sélectionner tous les événements `transaction.*` pour ne pas manquer les notifications de paiement. Enregistrer le secret de signature dans `FEDAPAY_WEBHOOK_SECRET_SANDBOX` côté Vercel ; il est différent des clés publique et secrète.

## 8. Contrôles post-déploiement
- `GET /api/health` → `{"ok":true,"db":true,"production":true,"demoMode":false,"fedapay":{"mode":"live|sandbox","configured":true,"webhookSecret":true},"storage":"s3","mail":true}`.
- `https://DOMAINE/robots.txt` et `/sitemap.xml` répondent ; les pages `/app`, `/admin`, `/scan`, `/orders` sont en `noindex`.
- Créer un compte, une organisation, un événement de test, un modèle de billet (publier), acheter un billet en sandbox, ouvrir le PDF, scanner le QR depuis un téléphone (vert), rescanner (orange).
- Vérifier la réception du webhook (table `payment_webhook_events`, `processed_at` renseigné) et l'exécution du cron.
- Exécuter `BASE=https://DOMAINE node scripts/smoke.mjs` sur un environnement de **recette** (il crée des données de test et utilise un événement de démonstration : `APP_ENV=staging DEMO_MODE=true` + `db:seed`).

## 9. Passage en mode production — check-list
☐ `APP_ENV` vide, `DEMO_MODE` absent · ☐ secrets forts uniques · ☐ clés FedaPay **live** + secret webhook live · ☐ webhook live testé · ☐ bucket privé configuré · ☐ Resend configuré · ☐ sauvegarde Neon testée (restauration d'une branche) · ☐ premier admin créé · ☐ frais configurés dans l'admin · ☐ textes légaux validés (pages `/legal/*` sont des modèles) · ☐ cron planifié · ☐ rate-limit : Redis si > 1 instance.

## 10. Retour à une version précédente
1. **Application** : redéployer l'artefact/commit précédent (Render : *Rollback* ; VPS : ré-activer le dossier `.output` précédent, `systemctl restart typs`).
2. **Base** : les migrations sont *forward-only*. Les écrire de façon rétro-compatible (ajouts avant suppressions). En cas de migration fautive : restaurer la branche Neon créée **avant** la migration (*Point-in-time restore*), puis redéployer la version applicative correspondante. Voir `DATABASE.md`.
3. Après retour arrière, vérifier `/api/health` et rejouer le parcours de recette.
