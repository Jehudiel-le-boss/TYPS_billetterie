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
La route `POST /api/internal/cron` libère les réservations expirées (après revérification FedaPay), envoie les rappels et prévient la liste d'attente. Sur un serveur Node persistant, l'appeler toutes les 5 minutes :
```bash
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://VOTRE-DOMAINE/api/internal/cron
```

## 7 bis. Déploiement Vercel (domaine TYPS actuel)
Le dépôt contient `vercel.json` : le build applique les migrations versionnées avec `DATABASE_URL_UNPOOLED`, puis construit Nuxt. Le plan Hobby de Vercel ne permet qu'un cron par jour ; il ne peut donc pas assurer l'expiration des réservations toutes les 5 minutes. Pour éviter un déploiement refusé et sans payer Vercel Pro, aucun cron Vercel n'est déclaré : utiliser un ordonnanceur externe tel que [cron-job.org](https://cron-job.org/en/), qui permet des appels HTTP POST toutes les minutes et des entêtes personnalisés.

Configuration conseillée dans cron-job.org :
1. Créer un cron vers `https://typs-ashy.vercel.app/api/internal/cron`, méthode `POST`, toutes les 5 minutes.
2. Ajouter l'entête `x-cron-secret` avec la valeur de `CRON_SECRET` configurée dans Vercel. Ne jamais mettre ce secret dans l'URL ou le corps. L'ordonnanceur externe détiendra ce secret ; si cette confiance n'est pas souhaitée, choisir Vercel Pro et un cron natif.
3. Vérifier dans l'historique des exécutions que la réponse est HTTP 200. L'endpoint accepte aussi `Authorization: Bearer <CRON_SECRET>` si l'ordonnanceur utilise cet entête.

cron-job.org est gratuit mais n'offre pas la même garantie de disponibilité qu'un ordonnanceur géré. Ses appels expirent après 30 secondes ; garder un intervalle de 5 minutes et surveiller les échecs. Vercel Pro est l'alternative si une planification native avec fréquence à la minute est requise.

Dans **Vercel → Settings → Environment Variables**, définir au minimum `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NUXT_PUBLIC_SITE_URL=https://typs-ashy.vercel.app`, `SESSION_SECRET`, `QR_SECRET`, `CRON_SECRET`, `FEDAPAY_ENV=sandbox`, `FEDAPAY_SECRET_KEY_SANDBOX` et `FEDAPAY_WEBHOOK_SECRET_SANDBOX`. Pour un lancement réel, ajouter aussi un bucket S3/R2 privé (`S3_BUCKET`, identifiants et région), `RESEND_API_KEY` et `MAIL_FROM`. Ne jamais copier le `.env` local dans le dépôt.

**E-mails et Brevo** : Brevo n'est pas nécessaire pour planifier ou exécuter le cron. Il faut en revanche un fournisseur d'e-mails pour envoyer les confirmations/rappels TYPS et les e-mails Neon Auth. TYPS intègre déjà Resend pour ses notifications ; garder Resend évite une modification du code. Brevo peut remplacer Resend, mais nécessite d'adapter l'intégration TYPS et/ou de configurer son SMTP dans Neon Auth. Ne pas payer les deux fournisseurs sans besoin.

La route `/api/health` expose `ready` et les contrôles manquants sans révéler de secret. En production, `ready` reste faux tant que la base, les secrets, HTTPS, FedaPay/webhook, S3, l'e-mail et Neon Auth ne sont pas configurés et joignables. Le disque local est refusé comme stockage de fichiers en production.

**Sauvegardes** : Neon fournit restauration temporelle/branches selon le plan. Vérifier la rétention active dans le tableau de bord, créer une branche avant les changements risqués et tester une restauration ; le code de l'application ne peut ni activer un plan Neon ni garantir une sauvegarde indépendante.

**Authentification Neon (Managed Better Auth)** : TYPS utilise le SDK officiel `@neondatabase/auth` côté navigateur. Définir `NEON_AUTH_BASE_URL` avec l'URL Auth de la branche Neon (format `https://…neonauth…/neondb/auth`) dans le `.env` local et dans Vercel ; cette URL est publique, ne pas y mettre de clé secrète. TYPS construit l'URL JWKS en ajoutant `/.well-known/jwks.json` à l'Auth URL. Chaque session est vérifiée côté serveur avec ce JWKS, puis reliée à un profil TYPS par l'identifiant Neon ou, lors de la première connexion, par l'adresse e-mail vérifiée. Les anciennes fiches utilisateurs sont conservées. Un utilisateur existant doit créer/valider son compte Neon avec la même adresse ; il retrouve alors ses organisations, billets et rôles TYPS. Les anciens formulaires custom de mot de passe sont désactivés en production.

Dans Neon Console, activer Managed Better Auth sur la même branche/base que l'application, activer l'inscription e-mail/mot de passe et exiger la vérification de l'adresse, ajouter `https://typs-ashy.vercel.app` et les domaines de recette comme domaines approuvés, configurer un fournisseur e-mail SMTP, personnaliser le nom de l'application et désactiver l'accès localhost en production. L'adresse de retour de vérification/réinitialisation doit être autorisée. Resend peut servir à Neon via SMTP (hôte `smtp.resend.com`, utilisateur `resend`, mot de passe = clé API Resend) ; cela permet de réutiliser le même fournisseur que TYPS. Le rôle PostgreSQL de l'application doit pouvoir lire `neon_auth."user"` ; `/api/health` contrôle ce droit ainsi que l'accès au JWKS. Voir [la checklist officielle Neon](https://neon.com/docs/auth/production-checklist) et [la configuration des domaines](https://neon.com/docs/auth/guides/configure-domains).

**Connexion Google** : Brevo n'intervient pas dans OAuth. Pour la production, créer un client OAuth Google de type Web, puis dans la configuration OAuth de Neon saisir son Client ID et Client Secret. Ajouter dans Google l'URI de redirection exacte donnée par Neon ; elle suit la forme `<NEON_AUTH_BASE_URL>/callback/google`. Ajouter aussi `https://typs-ashy.vercel.app` dans les domaines approuvés Neon. Le formulaire de connexion TYPS actuel ne propose pas encore de bouton Google : ces identifiants préparent le fournisseur Neon, mais une modification de l'interface et un test du retour de session seront nécessaires avant que les utilisateurs puissent s'en servir.

Le SDK `@neondatabase/auth` est actuellement distribué en version bêta ; valider inscription, vérification d'e-mail, connexion, réinitialisation et rattachement d'un ancien compte sur la branche Neon de recette avant l'ouverture commerciale.

**FedaPay webhook** : URL `https://typs-ashy.vercel.app/api/webhooks/fedapay`, vérification SSL activée, pas d'entêtes/corps personnalisés. Garder « recevoir tous les événements » ou sélectionner tous les événements `transaction.*` pour ne pas manquer les notifications de paiement. Enregistrer le secret de signature dans `FEDAPAY_WEBHOOK_SECRET_SANDBOX` côté Vercel ; il est différent des clés publique et secrète.

## 8. Contrôles post-déploiement
- `GET /api/health` → `ready:true`, `neonAuthStatus:"ready"` et aucun blocker ; le endpoint vérifie la table Neon Auth et l’accès à son JWKS.
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
