# Tâche — Audit et complétion des parcours TYPS

## Demande originale

> Responsive lors de la création des modèles de billets ça marche pas bien pour les champs en bas on voit pas vraiment, et lors de la validation ça nous parle d'un truc de contraste.
>
> Les rôles sur la plateforme et leur fonctionnement ne sont pas clairs. À l'inscription, on devrait pouvoir choisir si l'on veut acheter des billets, créer des événements pour en vendre, être agent, ou autre chose, avec un parcours distinct selon le choix. Ajouter si possible des aides qui n'apparaissent que la première fois pour expliquer le fonctionnement. Les utilisateurs devraient pouvoir changer de rôle ou en cumuler plusieurs.
>
> Une confiance insuffisamment démontrée :
>
> Le client doit comprendre si son paiement a réussi, où se trouve son billet et comment il pourra entrer à l'événement.
>
> À vérifier/corriger : confirmation de paiement vérifiée côté serveur, QR code unique, protection contre la réutilisation des billets, récupération des billets perdus et politique d'annulation claire.
>
> Liste d'audit — ce tableau constitue une liste d'audit, pas une liste de bugs confirmés sur TYPS :
>
> | Fonctionnalité | Ce qu'il faut vérifier |
> |---|---|
> | Paiements | Confirmation fiable, échecs, doublons et remboursements |
> | Billets | Génération automatique, PDF, QR code et récupération |
> | Contrôle d'accès | Scanner mobile, billet déjà utilisé et mode dégradé hors connexion |
> | Stocks | Quotas par tarif, expiration des réservations et ventes simultanées |
> | Organisateurs | Revenus nets, commissions, historique et reversements |
> | Événements | Brouillon, publication, report, annulation et clôture |
> | Administration | Validation des événements, gestion des litiges et détection de fraude |
> | Sécurité | Contrôle des accès, données personnelles et protection des paiements |
>
> Ordre de priorité proposé :
>
> 1. Simplifier la structure : distinguer clairement l'espace public, l'espace organisateur et l'administration.
> 2. Optimiser l'achat : rendre le prix total visible, réduire les étapes et faciliter le paiement mobile.
> 3. Fiabiliser les billets : paiement confirmé, QR code vérifiable, prévention des doublons et récupération.
> 4. Améliorer le tableau de bord : présenter les indicateurs utiles et les actions fréquentes sans surcharge.
> 5. Tester le responsive : contrôler les écrans sur téléphone, tablette et ordinateur, ainsi que les états de chargement, d'erreur et de liste vide.
>
> Références à étudier pour des idées de parcours et d'expérience :
>
> - TicketNid — découverte et vente d'événements, présentation des événements, prix de départ et appels à l'achat.
> - PaxEvent — étapes de réservation, paiement Mobile Money et récupération d'un billet perdu.
> - WuloEvents — expérience mobile, Mobile Money, billets électroniques et outils de vente sur le terrain.
>
> Fonctionnalités demandées pour les événements et les billets :
>
> - Permettre d'ajouter une FAQ à un événement.
> - Permettre d'ajouter une localisation Google Maps.
> - Permettre de saisir les dates et heures de début et de fin de l'événement.
> - Afficher éventuellement un compte à rebours en temps réel (« dans x jours, y heures, z secondes »). Le créateur doit pouvoir masquer ce compte à rebours et choisir les unités affichées, par exemple secondes ou non.
> - Permettre d'uploader une image d'événement sans supprimer les thèmes existants.
> - Ajouter des polices pour les billets et/ou permettre d'uploader un visuel de billet personnalisé, en conservant les champs dynamiques nécessaires, notamment le QR code et les autres informations choisies.
> - Mettre en place des cookies utiles à l'amélioration du site, dans le respect du consentement et des règles de confidentialité applicables.
> - Ajouter un éditeur Tiptap Pro pour les descriptions et autres champs pertinents.
>
> Auditer l'existant et implémenter ce qui manque, sans dupliquer ce qui est déjà présent. Prendre les décisions de conception raisonnables sans demander systématiquement de validation. Ne pas s'arrêter avant la fin.
>
> Créer un autre fichier Markdown qui récapitule exhaustivement ce qui a été vérifié, ajouté, corrigé, testé et ce qui reste éventuellement à faire.

## Objectif d'exécution

Effectuer un audit factuel du dépôt TYPS avant de conclure qu'un élément est absent ou défectueux. Distinguer explicitement :

- les fonctionnalités déjà présentes et vérifiées ;
- les défauts reproductibles et leurs corrections ;
- les manques fonctionnels confirmés ;
- les sujets nécessitant des paramètres externes, une validation métier ou un test sur un compte réel.

Ne pas présenter la liste d'audit ci-dessus comme une liste de vulnérabilités ou de bugs déjà confirmés.

## Portée minimale de l'audit

1. Création et édition de modèles de billets : mise en page responsive, accès aux champs en bas du formulaire, aperçu, erreurs de validation et diagnostic exact du contraste.
2. Inscription, rôles et espaces : rôles plateforme et organisation, sélection/intention d'usage à l'inscription, rôles cumulables ou modifiables, autorisations et navigation adaptée.
3. Aides de première utilisation : pertinence, persistance de l'état « déjà vu », possibilité de relancer l'aide et absence de répétition indésirable.
4. Parcours public et organisateur : découverte, création, publication, modification, report, annulation et clôture d'événements.
5. Achat et paiements : prix total avant paiement, états de succès/échec, confirmation serveur, idempotence, webhooks, doublons, remboursements et Mobile Money.
6. Billets : création après paiement confirmé, QR unique et vérifié côté serveur, prévention de réutilisation, PDF, récupération, transfert et annulation.
7. Contrôle d'accès : scan mobile, billet déjà utilisé, permissions agent et comportement hors connexion/synchronisation.
8. Stock : quotas par tarif, réservations temporaires, expiration et concurrence des ventes.
9. Organisateurs et administration : commissions, revenus nets, paiements et reversements, modération, litiges, journalisation et fonctions de contrôle existantes.
10. Demandes événementielles : FAQ, lieu/Google Maps, dates/heures de début et de fin, compte à rebours configurable, image d'événement et conservation des thèmes.
11. Personnalisation des billets : polices, visuels chargés par l'organisateur et maintien des données dynamiques et du QR.
12. Édition riche : vérifier Tiptap déjà installé ou intégré, ses licences/versions éventuelles et les champs pour lesquels il est approprié avant d'ajouter une dépendance.
13. Cookies et confidentialité : examiner les cookies réellement déposés, leur nécessité, le consentement, les préférences et la documentation légale avant toute implémentation.
14. Responsive et accessibilité : téléphone, tablette et bureau ; focus clavier, scroll, contrastes, messages de validation et états vides/chargement/erreur.
15. Sécurité et données personnelles : contrôles d'accès côté serveur, validation des entrées, protection des paiements et exposition minimale des données.

## Contraintes d'exécution

- Ne pas ouvrir, afficher, copier ou modifier `.env` ni aucune valeur secrète.
- Préserver tous les changements préexistants du dépôt.
- Ne pas créer de fonctionnalités en double ; réutiliser les composants, services et conventions déjà en place.
- Apporter des modifications chirurgicales, avec tests couvrant les comportements modifiés.
- Exécuter les vérifications ciblées puis les vérifications globales pertinentes (typecheck, lint, tests et build).
- Tester les parcours visibles dans l'application lorsque l'environnement le permet ; distinguer le test local d'une validation réelle en production.
- Mettre à jour directement la documentation liée aux fonctionnalités effectivement modifiées.
- Créer à la fin un second Markdown, `IMPLEMENTATION_REPORT.md`, recensant l'audit effectué, les constats vérifiés, les changements, les validations, les limites et les actions restantes.
- Ne pas pousser ou déployer sans demande explicite ultérieure.
