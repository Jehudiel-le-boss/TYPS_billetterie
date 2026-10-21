# Rapport d'audit et d'implémentation TYPS

## Résumé

Le cahier des charges initial est conservé dans [`TASK_AUDIT_IMPLEMENTATION.md`](./TASK_AUDIT_IMPLEMENTATION.md), créé avant les changements fonctionnels. Cet audit distingue les fonctionnalités vérifiées, les lacunes constatées et les risques qui demandent encore une validation externe. La liste fournie par l'utilisateur était une liste d'audit, pas une liste de défauts confirmés.

Les améliorations portant sur l'éditeur de billets, l'orientation des utilisateurs, les événements, les descriptions riches et la documentation sont implémentées dans le dépôt. Le lot initial a été commité et poussé sur `main`; cette révision ajoute le guide global et l'éditeur riche thème-adaptatif, avec ses dépendances et le glisser-déposer réordonnable. Une sauvegarde PostgreSQL locale a été créée et vérifiée avant d'exécuter `npm run db:migrate`. Le fichier `.env` a été lu à la demande de l'utilisateur; ses secrets n'ont été ni affichés, ni copiés dans le rapport ou transmis.

## Changements réalisés

### Studio des billets et QR

- Sur téléphone et tablette, les panneaux de l'éditeur participent maintenant au défilement normal de la page au lieu d'être enfermés dans une hauteur liée à la fenêtre; le défilement interne est réservé au grand écran.
- Le contrôle de publication explique le seuil de contraste QR requis (4:1) et exige des modules plus sombres que leur fond. Le bouton de correction remet le QR en noir sur blanc. Le contrôle client est aligné sur la règle serveur et empêche une publication impossible avant la requête.
- Les messages de validation distinguent maintenant le contraste QR de l'accessibilité générale des textes.
- L'éditeur permet aussi de faire glisser les champs dynamiques sur le billet (et de les déposer après un appui long sur téléphone), d'annuler/rétablir visiblement les changements, de choisir parmi six variantes de polices PDF intégrées et de régler le format de date. Les données fictives de prévisualisation sont modifiables sans altérer les données réelles des billets.
- L'aperçu PDF enregistre d'abord le modèle, reprend les données d'aperçu éditées et retourne une erreur visible si l'aperçu est interdit ou échoue. L'import d'image/PDF applique la limite serveur réelle de 6 Mo et signale l'échec de conversion. Le test PDF en lecture seule est accessible aux membres ayant le droit de lire l'événement.
- Le champ « Type de billet » affiche le type lié à la catégorie (VIP, standard, gratuit, etc.), distinct du nom de la catégorie. L'ancien champ VIP reste rendu dans les modèles existants, mais n'est plus proposé aux nouveaux calques.
- Le nom personnalisé d'un calque ne masque plus son type d'objet : QR code, champ dynamique, texte, image ou forme sont indiqués séparément. Le PDF d'essai est téléchargé directement et les erreurs de génération sont affichées dans le Studio.
- Les échecs d'upload distinguent le stockage, l'enregistrement de la ressource et la création du lien; les fichiers temporaires sont supprimés au mieux quand une étape après l'upload échoue.
- Vérification réelle Cloudinary : un PNG synthétique a été envoyé puis relu comme PNG valide de mêmes dimensions, et l'objet temporaire a été supprimé. Cloudinary réencode l'image, donc l'égalité binaire n'est pas attendue. Cette vérification du stockage ne remplace pas un essai authentifié de la route `/api/uploads`.

### Parcours et rôles

- L'inscription propose un parcours initial : acheter, organiser ou scanner. Ce choix ne confère aucune permission; il dirige vers la bonne destination. Un agent doit toujours être invité et autorisé par un organisateur.
- L’espace organisateur permet de basculer entre toutes les organisations de l’utilisateur et d’en créer plusieurs depuis le sélecteur de la barre latérale; rejoindre une organisation existante reste soumis à son invitation.
- Un guide de démarrage apparaît une première fois dans le navigateur et peut être rouvert. Il explique que l'achat, l'appartenance à plusieurs organisations et l'affectation à plusieurs événements peuvent coexister.
- Dans l'équipe d'une organisation, le rôle d'un membre non-propriétaire peut être modifié sans le supprimer puis le réinviter. Les permissions effectives restent vérifiées côté serveur.
- Les rôles d'organisation restent singuliers par organisation. Les autorisations de vente et de scan par événement se règlent dans l'équipe de l'événement.
- L'achat en ligne reste possible sans compte. Après paiement, le client peut créer un compte ou se connecter; un espace « Mes achats » regroupe les commandes en ligne faites avec la même adresse e-mail vérifiée. L'accès à la liste et aux commandes est contrôlé côté serveur; le lien sécurisé de commande reste disponible pour les achats sans compte.

### Événements

- Le formulaire de création permet de renseigner début et fin avec l'heure, le lieu, l'adresse, la ville et des coordonnées facultatives; l'édition existante a été alignée.
- Le choix de catégorie et de visibilité à la création utilise des boutons sélectionnables avec état actif clair. L'organisateur peut ouvrir Google Maps puis coller un lien avec coordonnées, ou saisir latitude/longitude; le formulaire extrait les positions courantes des URL Google Maps et explique quand le lien ne contient pas de coordonnées.
- La création enregistre événement, emplacement et journal d'audit dans une même transaction. Les échecs serveur ont des messages contextualisés et une référence de diagnostic; les erreurs HTTP sans message n'apparaissent plus comme une erreur réseau générique. La page publique propose Google Maps et, lorsque les coordonnées sont connues, OpenStreetMap.
- Les organisateurs peuvent ajouter jusqu'à 20 questions/réponses de FAQ.
- Le compte à rebours public peut être désactivé et ses unités (jours, heures, minutes, secondes) choisies. Les valeurs restent cohérentes même lorsque des unités intermédiaires sont masquées; il disparaît lorsque l'événement a commencé.
- L'affiche PNG/JPG pouvait déjà être ajoutée depuis la gestion de l'événement sans retirer son thème. Cette fonctionnalité a été conservée; l'affiche est également affichée sur la page publique. Elle s'ajoute au brouillon après sa création.

### Texte et personnalisation

- Les champs de description utilisent un éditeur Tiptap enrichi : historique, titres, gras/italique/souligné/barré, listes, alignement, citations, liens, images distantes avec texte alternatif, couleurs, surlignage, mode focus, comptage du texte et collage propre; ses contrôles reprennent les couleurs du thème actif. Ce sont des extensions open-source, sans fonctions commerciales Tiptap Pro.
- Les descriptions sont nettoyées avec une liste blanche cohérente côté éditeur, serveur et affichage; les anciens contenus texte brut et JSON Tiptap sont convertis.
- Les FAQ d'événement sont réordonnables par glisser-déposer et par commandes accessibles au clavier lors de la création et de l'édition. Les calques du Studio de billets sont également réordonnables. VueDraggable/SortableJS est utilisé pour ces listes; le glisser-déposer direct sur le canevas du billet reste géré par son éditeur spécialisé.
- Le studio de billets permettait déjà d'importer un arrière-plan PNG/JPG/PDF et d'y placer les champs dynamiques, dont le QR. Il conserve aussi les polices intégrées Sans, Serif et Mono. L'import de police personnalisée n'a pas été ajouté.

### Cookies et documentation

- Les cookies existants sont documentés : session nécessaire, préférence de thème et organisation active. L'état du guide est stocké dans `localStorage`.
- Aucun outil d'analyse d'audience ou cookie publicitaire n'est installé. Aucun suivi optionnel ni bannière de consentement n'a été ajouté sans finalité de suivi à déclarer.
- Les docs de base, de sécurité et de confidentialité décrivent les nouveaux champs, le nettoyage HTML et les cookies existants.

## Constats d'audit vérifiés

Les observations ci-dessous proviennent de la lecture du code et des documents du dépôt; elles ne constituent pas une certification d'une intégration de paiement en production.

- **Contrôle administrateur** : le dépôt possède des paramètres de fonctionnalités et une barrière serveur pour la création d'événement; l'interface affiche aussi l'état désactivé.
- **Paiement et émission** : la documentation et les services décrivent la confirmation côté serveur par FedaPay, la déduplication des webhooks, l'idempotence des commandes et l'émission après règlement. Aucun paiement réel ou appel sandbox n'a été déclenché pendant cette tâche.
- **Billets et scans** : le QR est signé et vérifié côté serveur; la mise à jour atomique limite un billet à un seul scan en ligne accepté. Le PDF, le transfert et la récupération par lien sécurisé existent.
- **Mode hors connexion** : la synchronisation et les conflits sont pris en compte. Deux appareils isolés du réseau peuvent néanmoins accepter le même billet avant synchronisation; le système détecte ensuite le conflit, sans garantir une déduplication globale en temps réel.
- **Stocks** : les réservations temporaires, leur expiration, la protection des quotas et les opérations transactionnelles/idempotentes sont présentes dans le code et documentées.
- **Remboursements et reversements** : les remboursements et règlements aux organisateurs sont suivis manuellement; aucun reversement automatique n'est confirmé.
- **Événements** : les statuts brouillon, publié, suspendu, clôturé et annulé ainsi que les contrôles d'accès par organisation/événement sont présents.

## Base de données et déploiement

Une migration additive `0003_equal_whistler.sql` ajoute la FAQ et les options de compte à rebours. Elle est référencée dans le journal Drizzle et la documentation du schéma.

**Migration vérifiée et commande exécutée.** Un dump PostgreSQL direct au format custom compressé a été écrit hors du dépôt dans `D:\Programmation 2.0\TYPS\database-backups\typs-neondb-2026-10-20T09-38-09-713Z.dump`. `pg_restore --list` a lu son catalogue (86 entrées) et `pg_restore --file=NUL` a décompressé l'ensemble sans erreur. SHA-256 : `f820cda1581951105f4ff19aa24fef52e85858648ac982f74cd3c31641d0dad2`. Les permissions NTFS du dossier et du dump ont été restreintes à l'utilisateur courant, Administrateurs et SYSTEM. **Le dump n'est pas chiffré** et sa restauration complète sur une base isolée n'a pas été testée.

La vérification préalable a constaté que le journal Drizzle comportait déjà les quatre entrées de migration, jusqu'à `0003`, et que `events.faq`, `events.countdown_enabled` et `events.countdown_units` existaient déjà. `npm run db:migrate` a terminé avec succès; aucune modification de schéma supplémentaire n'était en attente. La vérification après exécution confirme toujours les quatre migrations et les trois colonnes. La migration 0003 était donc déjà appliquée avant cet appel.

La configuration Vercel du dépôt lance `npm run db:migrate` au début du build. Un dump logique vérifié est disponible, mais aucune restauration sur une seconde instance Neon n'a été testée; conserver ce fichier dans un emplacement sûr et tester une restauration isolée selon la procédure de reprise.

**Déploiement non effectué.** Le CLI Vercel disponible est connecté à `Jehudiel270` et ne voit pas le projet TYPS ni un environnement de préproduction; aucune liaison `.vercel` locale n'existe. Le domaine public `https://typs-ashy.vercel.app` répond, mais `/api/health` retourne `ready: false` avec le bloqueur `secrets`. Le site n'a pas été redéployé et aucun parcours de création/affichage d'événement n'a été testé en ligne.

Pour poursuivre sans exposer de secrets : fournir au CLI un compte Vercel qui a accès au projet TYPS et à un environnement de préproduction. Le schéma est déjà à jour sur la base reliée par la configuration locale; le déploiement et les essais d'événement restent à effectuer.

## Validation et limites

- Après mise à jour de PDF.js, Axios et Vitest vers 5.0.5, `npm run check` a réussi : typecheck, ESLint, **10 fichiers de test / 71 tests** et build Nuxt client/serveur.
- Pour les correctifs du Studio et de l'association catégorie/modèle, `npm run typecheck`, `npm run lint`, la suite complète (**10 fichiers / 83 tests**) et le build Nuxt de production ont réussi.
- `git diff --check` a été exécuté; il n'a signalé aucun défaut d'espacement (Git a émis uniquement des avertissements de conversion LF/CRLF).
- Le domaine public TYPS répond en HTTP 200, mais aucun test visuel authentifié du Studio n'a été possible. Le processus sur le port local 3100 sert un autre projet; il n'a pas été redémarré ni modifié. Les règles globales de scrollbar personnalisée, basées sur les couleurs d'accent et de fond du thème, sont présentes dans le CSS du projet et le bundle local.
- Aucun fournisseur de paiement, e-mail ou caméra n'a été sollicité; le comportement réel doit être testé sur un environnement de préproduction.
- Corrections de dépendances appliquées localement : Axios 1.20.0 forcé pour FedaPay, PDF.js 6.4.299 et Vitest 5.0.5; la commande `npm audit fix` a aussi rafraîchi les dépendances compatibles du lockfile. Cela supprime les alertes Axios/FedaPay, PDF.js et les alertes critiques de Vitest.
- Le dernier audit (`npm audit --omit=dev`) signale **15 vulnérabilités de production restantes (12 élevées, 3 modérées)**. L'audit complet en compte **19 (12 élevées, 7 modérées, aucune critique)**. Les alertes non résolues touchent principalement Nuxt/Nitro, Tailwind 3, les outils PostCSS et Drizzle Kit.
- Pas de `npm audit fix --force` : npm propose notamment de rétrograder Nuxt à 3.15.1 et Drizzle Kit à 0.18.1, ce qui serait une modification majeure/régressive non validée. Certaines alertes n'ont pas de correctif annoncé; la résolution complète requiert un chantier de mise à niveau/migration suivi de tests.
- Le lot initial est poussé sur `main`; les mises à jour npm décrites ici ne le sont pas. La sauvegarde a été créée et vérifiée, et la migration a été exécutée sans changement en attente. Le déploiement reste bloqué par l'accès au projet Vercel et le statut santé public qui signale `secrets`.

## Suite recommandée

1. Vérifier le statut des secrets requis dans Vercel avec le propriétaire du projet, puis déployer les mises à jour locales après revue et tests.
2. Tester la création, l'édition et la page publique d'un événement sur mobile, tablette et bureau.
3. Effectuer des essais FedaPay sandbox, de scan en ligne/hors ligne et de remboursement avec les configurations réelles.
4. Examiner les vulnérabilités npm restantes et planifier les mises à niveau majeures sans correction forcée non contrôlée.
5. Compléter les textes légaux et faire valider les obligations de confidentialité par un conseil compétent.

## Correctifs parcours événements, cartes et modèles (2026-10-21)

- La page de gestion ouvre maintenant l'aperçu avec le jeton secret de l'événement. L'API autorise ce jeton à afficher un brouillon sans publier les ventes; les brouillons et événements non publiés restent exclus de l'indexation.
- Le modèle de billet peut être choisi à la création et à la modification de chaque catégorie. Le moteur sélectionne ce modèle, puis retombe sur le modèle de l'événement, puis sur le gabarit TYPS. Les API n'acceptent que les modèles actifs de l'organisation de l'événement. La migration additive `0004_panoramic_lilandra.sql` ajoute la référence facultative au modèle.
- L'éditeur de billet fait défiler le panneau de propriétés après l'ajout d'un champ sur téléphone, y compris par appui simple depuis la palette. La gestion des catégories dispose aussi de cartes éditables sur petit écran; le tableau détaillé est réservé aux écrans moyens et grands.
- L'édition de lieu accepte les structures de coordonnées usuelles dans les URL Maps (`@lat,lng`, `!3d...!4d...`, `!2d...!3d...`, et les paramètres de recherche/destination). Une carte OpenStreetMap intégrée s'affiche quand les deux coordonnées sont valides; Google Maps reste disponible pour rechercher le lieu. Un raccourcisseur Maps qui ne contient pas ses coordonnées ne peut pas être résolu sans suivre un lien externe.
- Validation locale ciblée : typecheck, ESLint, 12 tests de contenu événementiel et 25 tests d'intégration (dont priorité du modèle de catégorie et repli événementiel), puis build Nuxt client/serveur réussi. Les tests d'intégration appliquent également la migration sur PGlite.
- Le parcours Vercel authentifié n'a pas été inspecté ou déployé dans cette session. Vérifier sur préproduction l'aperçu secret, l'iframe cartographique sur les navigateurs ciblés et les PDF de billets pour deux catégories liées à deux modèles.

## Revue de cohérence du parcours billets (2026-10-21)

- La page publique et le formulaire d'achat affichent maintenant le type de billet dérivé de la catégorie, comme le billet PDF, au lieu de reprendre l'ancien indicateur VIP. Une catégorie « Backstage » n'est donc plus présentée à tort comme VIP.
- La page publique n'envoie plus vers le paiement quand aucune catégorie n'est vendable; elle indique si les billets ne sont pas encore disponibles, si toutes les catégories sont épuisées ou si aucune vente n'est ouverte.
- Le bouton mobile de paiement respecte désormais l'acceptation des conditions comme le bouton bureau et affiche « Obtenir mes billets » pour une commande gratuite.
- L'onglet de gestion « Aperçu » ne plante plus si la FAQ provient d'un tableau réactif Vue : les données sont copiées champ par champ au lieu d'appeler `structuredClone` sur un proxy non clonable. Ce correctif cible le `DataCloneError` transmis par l'utilisateur.
- Vérifications automatisées : typecheck, ESLint, tests et build de production. Aucun navigateur authentifié partagé n'était disponible; le rendu visuel du parcours à des largeurs téléphone/tablette/bureau, l'achat réel et l'expérience depuis un compte organisateur restent à tester avant de certifier la réactivité complète.
