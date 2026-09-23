# Haru — coréen en React et TypeScript

Application React avec TypeScript strict, Vite et Supabase. L’interface, les
quiz, le chrono, la bibliothèque et les scores sont des composants React.

## Démarrage

Prérequis : Node.js 22.12 ou plus récent (vérifié avec Node 22.16).

```sh
npm ci
npm run dev
```

Ouvrir l’adresse indiquée par Vite, généralement `http://localhost:5173`.
Les dépendances sont verrouillées dans `package-lock.json`.

```sh
npm run typecheck  # vérification TypeScript
npm test          # tests Vitest / React Testing Library
npm run build     # vérification des types et compilation dans dist/
npm run preview   # aperçu du build de production
```

## Configuration et Supabase

Le projet Supabase existant fonctionne par défaut. Pour utiliser un autre
projet, copier `.env.example` vers `.env.local` et adapter les deux valeurs.
Les variables `VITE_` sont publiques : utiliser uniquement la clé publishable,
jamais une clé service-role.

`schema.sql` reste la référence de la base utilisée par React ; aucune migration
SQL n’est nécessaire pour cette réécriture. Ne pas le rejouer sur la base
existante. Le typage des tables se trouve dans `src/lib/database.types.ts`.

La connexion Google et les confirmations par e-mail redirigent vers l’adresse
courante. Si l’adresse de développement change, l’ajouter aux URL de
redirection autorisées dans Supabase Auth. La progression, les comptes et les
cartes restent dans le même projet Supabase, avec les mêmes règles RLS.

## Fonctionnalités conservées

- Mode clair, design responsive, mascotte tigre et sons désactivables.
- Entraînement : catégories, flashcards, saisie en hangul, raccourcis clavier,
  variantes de réponses et révision des erreurs.
- Chrono : 10, 20 ou 50 mots tirés au sort dans une catégorie, ou sélection
  manuelle. Les doublons identiques sont regroupés dans les quiz.
- Bibliothèque : catalogue complet paginé côté API, recherche français/coréen,
  filtres, sélection multiple persistante entre les onglets.
- Suppression multiple : réservée aux administrateurs, après confirmation.
  Elle affecte le catalogue partagé et la progression associée de tous les
  utilisateurs. Les droits sont également contrôlés par Supabase.
- Classements personnels : top 10 par catégorie et taille réelle de série ;
  sélections manuelles séparées des tirages aléatoires.
- XP, niveaux, série de jours actifs, objectif quotidien et badges.

Le chrono commence au lancement et s’arrête à la dernière réponse. Il continue
pendant les corrections. Chaque erreur ajoute 5 secondes ; le classement
privilégie les bonnes réponses, puis le temps avec pénalités. Les séries
interrompues ne rapportent ni score ni XP. « J’avais bon » est disponible
uniquement en entraînement. Une série complète rapporte 10 XP par bonne
réponse, 20 XP de fin et 25 XP supplémentaires pour un chrono.

## Compatibilité avec les données existantes

Les clés `cahier-coreen:prefs` et `haru:game:<id du compte>` sont conservées.
Les scores, XP, badges et préférences existants sont relus automatiquement
**sur la même origine** (protocole, hôte et port). Un passage de Live Server
à Vite sur un autre port donne un stockage navigateur différent. Pour
retrouver ces données, servir la nouvelle application à l’ancienne adresse,
par exemple `npm run dev -- --port 5500 --strictPort` si elle utilisait ce port.

Ces données locales ne sont pas synchronisées entre appareils. Les cartes et
la progression par mot restent synchronisées via Supabase, quelle que soit
l’adresse utilisée. Le classement est personnel, sans système anti-triche.

## Organisation

```text
src/
  App.tsx              Authentification, chargement et changement de compte
  Workspace.tsx        Navigation et orchestration des fonctionnalités
  components/          En-tête, bannière et sélecteur partagés
  pages/               Connexion, apprendre, chrono, mots, quiz, résultat, scores
  hooks/               Sauvegarde de progression
  lib/                 Cartes, scores, stockage, audio et client Supabase typé
  types.ts             Modèle de données de l’application
  styles.css           Styles de l’interface
public/assets/haru.svg  Mascotte locale
schema.sql             Schéma Supabase existant
```

L’ancien `app.js`, le `style.css` racine et les tests de l’ancienne interface
ont été supprimés. `index.html` est uniquement le point d’entrée Vite.

## Validation et déploiement

Les tests couvrent les parcours React, la connexion simulée, les changements
de compte, le stockage existant, le chrono, les pénalités, les classements,
les erreurs de sauvegarde, la sélection et la suppression. Ils utilisent un
DOM de test et un client Supabase simulé, sans modifier la base réelle.

Pour déployer, servir le contenu de `dist/` après `npm run build` et conserver
l’URL Supabase Auth autorisée. Vérifier dans le navigateur la connexion réelle,
le rendu mobile, le clavier coréen et les sons.

Documentation : [React et TypeScript](https://react.dev/learn/typescript),
[Vite](https://vite.dev/guide/).
