# Reprise du projet (état au 2 octobre 2026, fin de la phase P2)

Ce document rassemble tout ce qu'il faut pour continuer le projet dans une autre session (Claude Code sur le web ou ailleurs) : les prompts utilisés, les décisions prises, l'état du code et les questions ouvertes.

## 1. Prompts utilisés

### 1.1 Spécification

Le prompt principal est le fichier [SPEC_kingdom_legacy.md](../SPEC_kingdom_legacy.md) à la racine du dépôt (517 lignes). Il fait foi.

### 1.2 Demande initiale

> Ok j'ai créé un repos KLeg_Fantasy dans mon github pour créer mon App Kingdom Legacy, et un dossier KLef_Fantasy dans le dossier Claude sur mon mac, que je te partage. Je vais créer une app de jeu de Kingdom Legacy, tu peux lire le prompt complet : SPEC_kingdom_legacy.md dans le dossier sur mon mac, et l'appliquer ?
>
> Si tu as des questions, pose les avant.

### 1.3 Réponses aux questions de cadrage

> Spec mise à jour : relis les sections 0 bis et 13.
>
> 1. Données : rien n'existe. Site source : https://www.kingdomlegacygame.com (index : /expansions/FeudalKingdom, carte : /cards/FeudalKingdom/1). Périmètre : FeudalKingdom, cartes 0 à 139. Écris le scraper décrit en 0 bis, teste d'abord sur 5 cartes et montre-moi le résultat. Les coûts/productions/gloire sont dans les images : fais l'extraction visuelle toi-même dans la session, par lots d'environ 10 cartes. Les cartes validées et les images WebP sont versionnées et incluses dans le site (section 13.2) ; seul data/raw reste dans .gitignore.
>
> 2. Node : je l'installe depuis nodejs.org (LTS). En attendant, prépare l'arborescence et le code. Pas besoin de Homebrew ni de gh.
>
> 3. Git : fais git init. Remote : git@github.com:MON_USER/KLeg_Fantasy.git Aucun accès GitHub n'est configuré : génère une clé SSH (ed25519), affiche-moi la clé publique et dis-moi où la coller sur GitHub, puis teste la connexion.
>
> 4. Rythme : livre P0, puis arrête-toi pour mon retour avant P1.
>
> 5. Commits locaux par petits commits, push sur main à la fin de chaque phase.
>
> 6. Styles : OK pour CSS modules + variables CSS centralisées.
>
> Déploiement : GitHub Pages en "Deploy from a branch", branche gh-pages, via npm run deploy (paquet gh-pages). Détails en section 13.

### 1.4 Suite

> valentindrouet-dev
> node est installé
> je ne sais pas ou voir les fiches, mais vas y quand meme

Compte GitHub : `valentindrouet-dev`. Dépôt : `valentindrouet-dev/KLeg_Fantasy`.

### 1.5 Prompt à coller pour reprendre dans une nouvelle session

```
Tu reprends le projet Kingdom Legacy Digital. Lis dans l'ordre :
1. SPEC_kingdom_legacy.md (la spécification, elle fait foi)
2. docs/HANDOFF.md (état du projet, décisions, questions ouvertes)
3. docs/DATA_EXTRACTION.md (conventions des fiches de cartes)

Les phases P0 (données), P1 (moteur, docs/ENGINE.md) et P2 (interface,
docs/UI.md) sont terminées : 140 fiches dans data/cards/FeudalKingdom,
moteur dans src/engine, écrans dans src/ui, partie en ligne de commande
avec `npm run play`.
Le site se déploie tout seul à chaque push (docs/DEPLOY.md).
Commence par `npm install`, puis `npm test` et `npm run build` pour vérifier
que tout passe.

Règles de travail : une phase à la fois, arrêt pour mon retour à la fin de
chaque phase, petits commits, push sur main en fin de phase, TypeScript strict
sans any, interface en français, ne jamais inventer de données de carte.

Avant de commencer P3 (toutes les cartes), pose-moi les questions ouvertes
de la section 5 de docs/HANDOFF.md.
```

## 2. Décisions prises

| Sujet | Décision |
|---|---|
| Rythme | Livrer une phase, puis attendre le retour avant la suivante |
| Git | Petits commits locaux, push sur `main` à la fin de chaque phase |
| Styles | CSS modules + variables CSS centralisées (`src/ui/theme.css`) |
| Données | Extraction visuelle des images du site, par lots ; fiches et WebP versionnés ; `data/raw` hors dépôt |
| Déploiement | GitHub Pages depuis la branche `gh-pages`, construite et poussée par GitHub Actions à chaque push (`docs/DEPLOY.md`) au lieu de `npm run deploy` ; `base: "/KLeg_Fantasy/"` réglé dans `vite.config.ts` |
| Copies de cartes | Une fiche par numéro, même pour les cartes identiques |

## 3. État du code

Phases P0 (données), P1 (moteur) et P2 (interface jouable) terminées. Phases P3 à P6 non commencées (spec section 12). Détails du moteur : `docs/ENGINE.md`, de l'interface : `docs/UI.md`.

| Élément | Emplacement | État |
|---|---|---|
| Schémas Zod (cartes, ressources, stickers, extensions) | `src/data/schema.ts` | fait |
| Schéma de la sortie brute du scraper | `src/data/rawSchema.ts` | fait |
| Validation de cohérence | `src/data/validate.ts` | fait |
| Chargement côté navigateur | `src/data/loadCards.ts` | fait |
| Visionneuse de données | `src/ui/viewer/` | fait |
| Scraper | `scripts/scrape.ts` | fait, exécuté sur 140/140 cartes |
| Conversion WebP | `scripts/optimize-images.ts` | fait, 280 images |
| Planches de lecture | `scripts/stage-sheets.ts` | fait |
| Saisie des fiches | `scripts/extraction/` | fait, régénère les 140 fiches à l'identique |
| Fiches de cartes | `data/cards/FeudalKingdom/0.json` à `139.json` | 140 fiches, 0 invalide |
| Images | `data/images/FeudalKingdom/*.webp` | 280 images, 16 Mo |
| Tests des fiches | `tests/data/cards.test.ts` | 142 tests |
| Catalogue de stickers | `data/stickers.json` | fait (planche Feudal Kingdom v4.1, 12 stickers) |
| Moteur de règles (P1) | `src/engine/` | fait : tours, manches, actions, découvertes, annulation, score ; effets des cartes 1 à 10 |
| Partie en ligne de commande | `scripts/play.ts` (`npm run play`) | fait |
| Tests du moteur | `tests/rules/`, `tests/scenarios/` | 56 tests |
| Déploiement | `.github/workflows/deploy.yml` | fait (GitHub Actions, voir `docs/DEPLOY.md`) |
| Royaumes et sauvegarde (IndexedDB, Dexie) | `src/persistence/` | fait : créer, continuer, renommer, dupliquer, recommencer avant #23, supprimer ; autosave après chaque action |
| Interface de jeu (P2) | `src/ui/kingdoms`, `src/ui/game` | fait : plateau paysage et portrait, feuille d'actions, inspection, décisions, confirmations, journal, fin de partie |
| Export/import, points de sauvegarde, PWA | | non commencé (P3 et P5) |

Versions installées : Node 24, Vite 8, React 19, TypeScript 7, Zod 4, Vitest 5.

### Écarts par rapport au schéma de la spec (section 3.3)

- `category` : ajout de `goal` (cartes objectif, bandeau jaune mais pas des personnes) et `none` (parchemins, cartes de piste).
- `production` : liste de groupes `{ id, options }`, où `options` porte le « / ».
- `upgrades` : `cost` est une liste d'icônes ; `otherCost` porte les coûts non-ressources (« 2 Persons »).
- `fameVariable` : gloire calculée par un texte (ruban « * », cartes de piste).
- `checkboxes` : `gain`, `cost`, `fame`, `threshold`, `icon`, `text` selon la carte.
- `effects[].oneTime` : icône d'usage unique en plus du type.
- `flavor`, `siteKeywords`, `helpText` par stage ; `origin` par carte.

## 4. Fiabilité des données

- Tout vient des images du site (373 × 520 px, dernière impression). Rien n'a été comparé au jeu physique.
- 86 cartes portent une note `to_verify`. Beaucoup sont des notes de version du site.
- 17 cartes ont une confiance inférieure à 0,9 : 25, 26, 27, 77, 87, 88, 89, 90, 91, 98, 109, 121, 134, 135, 136, 137, 138.
- Recoupements faits : types d'effet contre le glossaire du site ; chaque « Discover X (n) » contre la carte n ; petites icônes relues sur agrandissement.

## 5. Questions ouvertes

1. ~~**Dernière manche**~~ : tranché le 2026-10-02, c'est la carte 68 (`docs/RULES_DECISIONS.md`).
2. ~~**Coûts « N Persons »**~~ : tranché le 2026-10-02, on défausse les personnes depuis la zone de jeu (`docs/RULES_DECISIONS.md`).
3. ~~**Sticker 16**~~ : réglé le 2026-10-02 avec la planche officielle : c'est un ruban de gloire vierge où l'on écrit le nombre, utilisé pour la gloire purgée comme pour la carte 138. Catalogue dans `data/stickers.json`.
4. ~~**GitHub Pages est public**~~ : accepté le 2026-10-02, le dépôt et le site sont publics (`docs/DEPLOY.md`).
5. **Carte 0 et carte 139** : marquées parchemin par analogie visuelle ; elles ne sont jamais découvertes en jeu.

## 6. Ce qui n'est pas dans le dépôt

- `data/raw/` (110 Mo) : HTML en cache, JSON bruts, JPEG originaux, planches de lecture. Se régénère avec `npm run scrape` puis `npx tsx scripts/stage-sheets.ts`. Une archive séparée a été fournie.
- `node_modules/`, `dist/` : se régénèrent avec `npm install` et `npm run build`.
- La clé SSH créée sur le Mac (`~/.ssh/id_ed25519`) : elle n'a jamais été enregistrée sur GitHub, aucun push n'a eu lieu.
