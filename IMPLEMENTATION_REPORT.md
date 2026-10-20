# Rapport d'audit et d'implémentation TYPS

## Résumé

Le cahier des charges initial est conservé dans [`TASK_AUDIT_IMPLEMENTATION.md`](./TASK_AUDIT_IMPLEMENTATION.md), créé avant les changements fonctionnels. Cet audit distingue les fonctionnalités vérifiées, les lacunes constatées et les risques qui demandent encore une validation externe. La liste fournie par l'utilisateur était une liste d'audit, pas une liste de défauts confirmés.

Les améliorations portant sur l'éditeur de billets, l'orientation des utilisateurs, les événements, les descriptions riches et la documentation sont implémentées dans le dépôt. La migration de base de données est générée, mais n'a pas été appliquée. Aucun secret ni fichier `.env` n'a été consulté ou modifié. Aucun commit, push ou déploiement n'a été effectué.

## Changements réalisés

### Studio des billets et QR

- Sur téléphone et tablette, les panneaux de l'éditeur participent maintenant au défilement normal de la page au lieu d'être enfermés dans une hauteur liée à la fenêtre; le défilement interne est réservé au grand écran.
- Le contrôle de publication explique le seuil de contraste QR requis (4:1) et exige des modules plus sombres que leur fond. Le bouton de correction remet le QR en noir sur blanc. Le contrôle client est aligné sur la règle serveur et empêche une publication impossible avant la requête.
- Les messages de validation distinguent maintenant le contraste QR de l'accessibilité générale des textes.

### Parcours et rôles

- L'inscription propose un parcours initial : acheter, organiser ou scanner. Ce choix ne confère aucune permission; il dirige vers la bonne destination. Un agent doit toujours être invité et autorisé par un organisateur.
- Un guide de démarrage apparaît une première fois dans le navigateur et peut être rouvert. Il explique que l'achat, l'appartenance à plusieurs organisations et l'affectation à plusieurs événements peuvent coexister.
- Dans l'équipe d'une organisation, le rôle d'un membre non-propriétaire peut être modifié sans le supprimer puis le réinviter. Les permissions effectives restent vérifiées côté serveur.
- Les rôles d'organisation restent singuliers par organisation. Les autorisations de vente et de scan par événement se règlent dans l'équipe de l'événement.

### Événements

- Le formulaire de création permet de renseigner début et fin avec l'heure, le lieu, l'adresse, la ville et des coordonnées facultatives; l'édition existante a été alignée.
- Le lieu peut être recherché dans Google Maps. La page publique propose Google Maps et, lorsque les coordonnées sont connues, OpenStreetMap.
- Les organisateurs peuvent ajouter jusqu'à 20 questions/réponses de FAQ.
- Le compte à rebours public peut être désactivé et ses unités (jours, heures, minutes, secondes) choisies. Les valeurs restent cohérentes même lorsque des unités intermédiaires sont masquées; il disparaît lorsque l'événement a commencé.
- L'affiche PNG/JPG pouvait déjà être ajoutée depuis la gestion de l'événement sans retirer son thème. Cette fonctionnalité a été conservée; l'affiche est également affichée sur la page publique. Elle s'ajoute au brouillon après sa création.

### Texte et personnalisation

- Les champs de description de création et d'édition utilisent Tiptap avec StarterKit open-source (gras, italique, listes). Les fonctionnalités commerciales Tiptap Pro n'ont pas été ajoutées.
- Les descriptions sont nettoyées côté serveur à l'enregistrement et à la lecture publique/gestionnaire, avec une liste blanche HTML.
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

**Migration non appliquée.** La commande du projet (`npm run db:migrate`) exige `DATABASE_URL_UNPOOLED` ou `DATABASE_URL`, absente de l'environnement de cette session. Le fichier `.env` n'a pas été ouvert ni chargé, conformément à la consigne de ne pas y accéder. La cible Neon n'a donc pas pu être déterminée sans risque d'appliquer le schéma à la mauvaise base.

Avant d'utiliser les nouvelles colonnes en production, définis toi-même la variable `DATABASE_URL_UNPOOLED` (ou `DATABASE_URL`) dans un terminal sécurisé pointant vers la base correcte, vérifie la sauvegarde, puis lance `npm run db:migrate`. Ne partage pas cette URL. La migration ajoute uniquement les trois colonnes FAQ/compte à rebours.

## Validation et limites

- La commande complète `npm run check` (typecheck, ESLint, tests Vitest et build Nuxt) a réussi : **10 fichiers de test, 71 tests passés**, build client et serveur terminé.
- `git diff --check` a été exécuté; il n'a signalé aucun défaut d'espacement (Git a émis uniquement des avertissements de conversion LF/CRLF).
- Aucun test visuel dans un navigateur ni sur un déploiement n'a été exécuté. Les règles globales de scrollbar personnalisée existaient déjà et utilisent les couleurs d'accent et de fond du thème.
- Aucun fournisseur, e-mail, caméra ou paiement réel n'a été sollicité; le comportement réel doit être testé sur un environnement de préproduction.
- L'audit npm de production (`npm audit --omit=dev`) signale **18 vulnérabilités transitives : 15 élevées et 3 modérées**, notamment dans les dépendances FedaPay/Axios, Nuxt/listhen, Tailwind et PDF.js. Ces alertes n'ont pas été corrigées ici : certaines n'ont pas de correctif disponible ou imposeraient une mise à niveau majeure. Elles doivent être triées et planifiées séparément.
- Aucun commit, push ou déploiement n'a été effectué.

## Suite recommandée

1. Relire et appliquer la migration sur une base de préproduction.
2. Tester la création, l'édition et la page publique d'un événement sur mobile, tablette et bureau.
3. Effectuer des essais FedaPay sandbox, de scan en ligne/hors ligne et de remboursement avec les configurations réelles.
4. Examiner séparément les vulnérabilités npm et planifier des mises à niveau sans utiliser de correction forcée non contrôlée.
5. Compléter les textes légaux et faire valider les obligations de confidentialité par un conseil compétent.
