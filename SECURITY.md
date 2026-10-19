# SECURITY — modèle de sécurité de TYPS

## Authentification et sessions
Mots de passe : **scrypt** (N=16384, sel aléatoire), comparaison en temps constant, vérification factice si le compte n'existe pas. Sessions : jeton aléatoire 256 bits, **seul son hash SHA-256 est stocké**, cookie `typs_session` **HttpOnly, SameSite=Lax, Secure en production**, expiration 30 j, révocable (déconnexion, suspension de compte, réinitialisation du mot de passe → toutes les sessions révoquées). Vérification d'e-mail et récupération de compte par jetons à usage unique hachés (48 h / 1 h). Réponses non énumérantes (« si un compte existe… »).

## Autorisations (toujours côté serveur)
`shared/permissions.ts` : rôles d'organisation (owner, manager, seller, agent, viewer) + affectations d'événement (`event_staff` : scan / vente). `requireOrg` / `requireEvent` sont appelés par **chaque** route ; les liens masqués dans l'interface ne sont qu'un confort. Hors périmètre → 404 (pas de fuite d'existence). Administration : `platform_role = 'admin'` en base (aucun administrateur codé en dur ; promotion via `BOOTSTRAP_ADMIN_EMAIL` au seed ou par un admin). Un agent révoqué perd l'accès immédiatement (le droit est revérifié à chaque scan).
Commandes/billets : accès par **jeton d'accès** (lien e-mail, haché en base), compte vérifié de même adresse, ou équipe de l'organisateur — jamais par identifiant seul.

## CSRF, XSS, injections
CSRF : cookies SameSite=Lax + contrôle d'origine (`Origin` / `Sec-Fetch-Site`) sur toute requête mutante `/api` (hors webhook signé et cron à secret). XSS : Vue échappe par défaut, `v-html` interdit dans le code, CSP/en-têtes (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS en production) via `server/middleware/security.ts`. SQL : Drizzle paramétré ; le SQL brut utilise des paramètres liés. Entrées : **Zod** sur chaque corps/paramètre ; gabarits de billet re-validés (`sanitizeLayout`) ; export CSV neutralisant l'injection de formules.

## QR codes
Contenu : `TYPS1.<uuid>.<version>.<HMAC-SHA256 128 bits>` — **référence opaque signée**, aucune donnée personnelle, imprévisible (le numéro imprimé `TY-XXXXXXXX` n'est pas le contenu du QR). Vérifié en temps constant côté serveur (`QR_SECRET`). `qr_version` incrémenté au transfert → l'ancien QR est invalidé. Test de lisibilité (contraste ≥ 4:1, taille ≥ 90 px, décodage jsQR) à la publication d'un modèle.
**Limite assumée** : un QR peut être photographié ; la protection est l'usage unique validé par le serveur (premier scan accepté, suivants orange).

## Paiements FedaPay
Création de transaction **côté serveur** (clé secrète jamais exposée au navigateur ni au dépôt). **La redirection de retour n'est jamais une preuve** : l'ordre est réglé uniquement après relecture de la transaction chez FedaPay (`Transaction.retrieve`) avec contrôle **statut = approved, montant et devise identiques**. Webhook : signature vérifiée par le **SDK officiel** (`Webhook.constructEvent`, en-tête `X-FEDAPAY-SIGNATURE`), déduplication (`dedupe_key`), puis relecture serveur-à-serveur ; rejeu sans effet ; erreur → 500 pour que FedaPay réessaie. Paiement tardif après expiration : places reprises si possible, sinon **remboursement requis** créé automatiquement. TYPS ne stocke aucune donnée de carte. Remboursements : l'API de remboursement n'est pas confirmée → flux **manuel tracé** (`refunds`) ; reversements aux organisateurs : suivi/rapprochement + enregistrement manuel (`settlements`), **aucun virement automatique supposé**.

## Fichiers
Téléversements : taille ≤ 6 Mo, type **réel** par octets magiques (PNG/JPEG ; SVG refusé), dimensions ≤ 6000 px, nom de stockage généré (`org/<id>/<type>/<aléatoire>.ext`), jamais le nom du client, isolation par organisation. Lecture par **URL signée temporaire** (S3 pré-signé, ou route locale HMAC en développement). PDF importés : convertis en image **dans le navigateur** puis traités comme PNG.

## Limitation de débit, audit, détection
Limiteur à fenêtre glissante **en mémoire par instance** (login, inscription, achat, scan, upload, webhook…) — pour plusieurs instances, le remplacer par Redis/Upstash (interface `rateLimitCheck`). `audit_logs` : création/modification d'événements, publication, ventes physiques et annulations, scans hors ligne, exports, changements de frais (avant/après), modération, reversements. Les alertes de comportement suspect sont **explicables** (doublons, refus affichés dans le mode direct) ; aucun refus définitif n'est décidé par un score heuristique.

## Mode hors ligne (limites visibles dans l'interface)
Pack = empreintes tronquées (SHA-256) + catégorie + référence, **sans secret de signature**, stocké **chiffré AES-GCM** (clé non exportable en IndexedDB), **expirant à 12 h**, désactivable par l'organisateur. Les scans hors ligne sont rejoués à la reconnexion avec la même règle atomique ; **deux appareils déconnectés peuvent accepter le même billet** : le second est enregistré comme doublon (`conflict = true`). Aucune garantie anti-doublon globale en temps réel n'est prétendue.

## Secrets et configuration
Secrets lus à l'exécution (`process.env`), jamais committés (`.env` ignoré), jamais envoyés au navigateur. En production, `SESSION_SECRET` et `QR_SECRET` (≥ 16 caractères) sont obligatoires (le serveur refuse de démarrer sans). **Mode démo impossible en production** (`APP_ENV` vide/`production`). Rotation de `QR_SECRET` = invalidation de tous les QR émis : à éviter hors incident.

## Points à traiter avant la production
Faire relire les textes légaux ; configurer Redis pour le rate-limit si multi-instances ; activer l'envoi d'e-mails (Resend) ; configurer le webhook FedaPay et tester en sandbox puis en live ; sauvegardes Neon testées ; revue de conformité des données personnelles (Code du numérique du Bénin, autorité de protection des données) par un juriste local.
