# Kingdom Legacy Digital : spécification projet

> À placer à la racine du dépôt (ou à référencer depuis `CLAUDE.md`).
> Usage strictement personnel. Je possède le jeu physique et toutes ses extensions.
>
> **Périmètre actuel : tout le contenu de la boîte Feudal Kingdom (cartes 0 à 139), y compris les 3 mini-extensions (cartes 136, 137, 138) et la purge.** Les grandes extensions vendues à part sont hors périmètre pour l'instant, mais l'architecture doit permettre de les ajouter plus tard sans refonte (tout ce qui concerne une extension est data-driven).

---

## 0. Instructions de travail pour Claude Code

- **Ne jamais inventer de données de carte.** Toute donnée vient de `./data/cards/` (produite par le scraper). Si une info manque ou semble douteuse, marque-la `to_verify` et signale-la, ne devine pas.
- **Règles ambiguës** : pose-moi la question, puis consigne la décision dans `docs/RULES_DECISIONS.md` (date, question, décision, cartes concernées).
- **Le moteur d'abord, testé, sans UI.** Le moteur doit pouvoir jouer une partie complète en CLI / tests avant toute interface.
- Travaille par phases (section 12). À la fin de chaque phase : récap court, ce qui reste, ce qui est à vérifier.
- Commits petits et explicites. TypeScript strict, pas de `any`.
- Interface en **français**, textes de cartes en **anglais** (données d'origine), avec un champ `text_fr` optionnel pour plus tard.

---

## 0 bis. Source des données et scraper

- **Site source** : https://www.kingdomlegacygame.com (site officiel). Index de l'extension : https://www.kingdomlegacygame.com/expansions/FeudalKingdom ; une carte : https://www.kingdomlegacygame.com/cards/FeudalKingdom/1
- Structure observée sur une page de carte : nom de la carte, description, nombre d'exemplaires, sections `stage-1` à `stage-4` avec mots-clés et parfois le texte de l'effet, et deux images (recto avec stages 1-2, verso avec stages 4-3, ex. `/frontend/images/FeudalKingdom/FK_Page_003.jpg` et `FK_Page_004.jpg`). Les coûts, productions, gloire et flèches d'amélioration sont **dans les images**, pas dans le HTML.
- **Périmètre** : FeudalKingdom uniquement, cartes 0 à 139.
- **Scraper à écrire** (`scripts/scrape.ts`) : crawl poli (1 requête/s max, cache local, reprise possible), extraction du HTML vers `data/raw/FeudalKingdom/{n}.json`, téléchargement des images vers `data/images/FeudalKingdom/`. Vérifier d'abord la faisabilité sur 5 cartes (HTML rendu côté serveur ou non, liste des numéros) et me montrer le résultat.
- **Extraction visuelle** : tu lis toi-même les images dans la session Claude Code, par lots d'environ 10 cartes, et tu produis `data/cards/FeudalKingdom/{n}.json` conforme au schéma Zod, avec `confidence` et `to_verify`. Pas besoin de clé API.
- Je vérifie ensuite les cartes via la visionneuse de données (P0).

---

## 1. Objectif

Une application jouable sur **iPad et ordinateur** qui permet de jouer à Kingdom Legacy **Feudal Kingdom** (jeu de base) en respectant **toutes** les règles, avec **toutes** ses cartes, et qui permet de mener **plusieurs royaumes en parallèle** (comme des sauvegardes) et, plus tard, d'**ajouter des cartes maison**.

Priorités, dans l'ordre :
1. Fidélité aux règles.
2. Confort sur iPad (tactile) et ordinateur (souris/clavier).
3. Extensibilité (cartes custom).
4. Beauté.

---

## 2. Stack technique

- **Vite + React + TypeScript (strict)**
- **PWA** (`vite-plugin-pwa`) : installable, 100 % hors ligne, images de cartes en cache.
- **État** : moteur pur (fonctions `(state, action) => state`) + store UI léger (Zustand).
- **Persistance** : IndexedDB via **Dexie**.
- **Validation des données** : **Zod** (schémas = source de vérité, types TS dérivés).
- **Tests** : **Vitest** (moteur), Playwright (quelques parcours UI en fin de projet).
- **Styles** : Tailwind ou CSS modules, au choix, mais tokens de thème centralisés.
- **Animations** : CSS transforms 3D (flip/rotation) + Framer Motion si utile. Respecter `prefers-reduced-motion`.
- Aucun backend.

Arborescence cible :

```
/data
  /raw/{Expansion}/{n}.json        # sortie brute du scraper
  /images/{Expansion}/...          # images des cartes
  /cards/{Expansion}/{n}.json      # cartes validées (schéma section 3)
  /custom/{MonExtension}/...       # cartes maison, même format
  stickers.json                    # catalogue des stickers
  expansions.json                  # métadonnées des extensions
/src
  /engine                          # moteur pur, aucune dépendance UI
    /effects                       # interpréteur du DSL d'effets
    /scripts                       # scripts spécifiques par carte (exceptions)
  /data                            # chargement + validation Zod
  /ui
  /persistence
/tests
  /rules                           # un fichier par règle
  /scenarios                       # parties scriptées
/docs
  RULES_DECISIONS.md
  CARD_DSL.md
```

---

## 3. Modèle de données

### 3.1 Principes

- Distinguer **CardTemplate** (données statiques de la carte, issues du scraper) et **CardInstance** (état vivant dans une partie : orientation, stickers, cases cochées...).
- Une carte physique = une instance. Vérifier avec les données si plusieurs cartes partagent un même modèle (ex. "4 copies" de Wild Grass) et modéliser en conséquence.
- **Ne pas supposer** la correspondance face/rotation → stage : elle vient des données de chaque carte (le site présente le recto avec stages 1 et 2, le verso avec stages 4 puis 3).

### 3.2 Orientation

```ts
type Side = "front" | "back";
type Rotation = 0 | 180;
type Orientation = { side: Side; rotation: Rotation };
// Chaque template fournit orientationToStage: Record<"front-0"|"front-180"|"back-0"|"back-180", StageId | null>
```

### 3.3 CardTemplate (à définir en Zod)

```ts
CardTemplate {
  id: string;                    // "FeudalKingdom-001"
  expansion: string;
  serial: number;                // numéro du sceau
  images: { front: string; back: string };
  orientationToStage: {...};
  isParchment: boolean;          // carte parchemin : instructions puis destruction
  chooseSideOnDiscover: boolean; // flèches en haut : choisir la face à la découverte
  isFinalRoundMarker?: boolean;  // #68 (voir docs/RULES_DECISIONS.md)
  stages: Record<StageId, Stage>;
  description?: string;          // texte d'aide du site
  source: { url: string; scrapedAt: string };
  confidence: number;            // 0..1
  to_verify: string[];
}

Stage {
  id: StageId;                   // 1..4
  name: string;
  keywords: Keyword[];           // Building, Person, Land, Livestock, Seafaring, Other, Enemy, Event...
  category: "building"|"person"|"land"|"livestock"|"seafaring"|"other"|"negative";
  negative: boolean;             // bandeau rouge / crâne
  permanent: boolean;            // structure en pierre en haut
  fame: number;
  production: ProductionOption[];// ex. [[{coin:1}], [{wood:1},{stone:1},{metal:1}]] gère le "/" = OU
  upgrades: Upgrade[];
  effects: Effect[];             // DSL, section 5
  checkboxes: Checkbox[];        // petites cases, éventuellement avec icône
  staysInPlay: boolean;
  equip?: { keyword: Keyword };  // équipement : 3e bandeau rouge "Equip X"
  cannotBeDestroyed?: boolean;
  cannotBePurged?: boolean;
  defeat?: DefeatSpec;           // destroy | turn (flip) | checkbox | none
  text: string;                  // texte brut de l'effet (affichage + fallback)
}

Upgrade { cost: ResourceCost; arrow: "rotate" | "flip"; toStage: StageId; }
```

### 3.4 CardInstance

```ts
CardInstance {
  instanceId: string;
  templateId: string;
  orientation: Orientation;
  zone: "box" | "deck" | "play" | "discard" | "permanent" | "blocked" | "destroyed" | "purged" | "equipped";
  stickers: StickerPlacement[];  // par stage : ressource (1-6), gloire, tab...
  checkedBoxes: string[];
  crossedOutEffects: string[];   // effets "one-time" utilisés
  crossedOutProduction: string[];
  equippedTo?: string;           // instanceId du porteur
  blockedBy?: string;
  tab?: string;                  // sticker tab visible dans le deck
}
```

### 3.5 Ressources

Base : `coin, wood, stone, metal, sword, tradeGood`. Les extensions peuvent en ajouter : **le système de ressources doit être data-driven** (`resources.json`), et "any 1 resource" inclut les nouvelles ressources.

### 3.6 Stickers

`stickers.json` : numéro, type (ressource, gloire, tab, score path, purged fame...), quantité disponible. **Je fournirai ce catalogue** (le site ne le contient peut-être pas) : prévois un fichier squelette à remplir. Règle : si le sticker demandé n'est plus disponible, l'effet est ignoré.

---

## 4. Moteur de règles

### 4.1 Architecture

- **Event-sourcing** : l'état d'une partie = état initial + liste d'actions. Permet undo, replay, debug, export.
- **RNG à graine** (mélanges reproductibles), graine stockée dans la sauvegarde.
- `getLegalActions(state): Action[]` : l'UI n'affiche que des actions légales.
- **Décisions en attente** : quand une règle exige un choix du joueur (cible, ordre de résolution, option d'un "/", carte à découvrir parmi plusieurs, sélection de purge, face d'une carte à flèches), le moteur s'arrête dans un état `pendingDecision` typé que l'UI résout.

### 4.2 Règles d'or (à faire respecter strictement)

1. Une carte ne change jamais d'orientation sans règle qui le permette.
2. On peut inspecter toutes les faces des cartes **en jeu et dans la défausse**, mais **jamais** les cartes encore dans la boîte (seulement leur numéro).
3. Toute carte qui change d'orientation (amélioration ou autre effet) est **immédiatement défaussée**.
4. Améliorer une carte **termine le tour**.
5. Impossible d'ajouter un sticker de ressource à une carte qui produit déjà **9 ou plus**.

### 4.3 Mise en place

- Cartes 1 à 10 = royaume. Le reste reste dans la boîte (cartes découvrables).
- Mélange sans changer l'orientation, deck face visible : **le joueur voit toujours la carte du dessus du deck**, jamais la deuxième.

### 4.4 Déroulé

**Manche** : une suite de tours jusqu'à épuisement du deck.

**Début de manche** (sauf la première) : découvrir les 2 cartes suivantes dans l'ordre des numéros. Si la première est une **carte parchemin** : appliquer ses instructions puis la détruire (pas de découverte normale). Puis mélanger toutes les cartes du royaume (hors permanentes) en nouveau deck.

**Début de tour** : jouer les 4 cartes du dessus (ou toutes s'il en reste 1 à 3).

**Actions**, enchaînables jusqu'à fin de tour :
1. **Produire** : défausser une carte pour gagner sa production. Pas de production = pas d'action Produire. Une carte défaussée par un autre effet ne produit pas.
2. **Améliorer** : payer le coût de la boîte marron, appliquer la flèche (↓ = rotation 180°, → = retournement vers le stage indiqué), défausser la carte, **fin du tour**.
3. **Utiliser un effet** (voir types d'effets 5.2).
4. **Avancer** : jouer 2 cartes de plus. Répétable.
5. **Passer** : fin du tour.

Une **rotation/retournement par effet** n'est PAS une amélioration et ne termine pas le tour, mais la carte est défaussée (règle d'or 3).

**Fin de tour** : effets "End of Turn", puis défausser les cartes en jeu sauf celles qui "stay in play". Nouveau tour s'il reste des cartes, sinon fin de manche. Un deck vide entraîne toujours la fin de manche après le tour en cours.

**Fin de manche** : défausser tout (y compris "stay in play"), appliquer les effets "End of Round" des cartes défaussées.

**Fin de partie** : la découverte de la carte **#68** (parchemin qui fait découvrir 69 et 70) lance la dernière manche (décision du 2026-10-02, `docs/RULES_DECISIONS.md`). Ensuite, score = somme de la gloire du royaume + gloire purgée cumulée. Les cartes au-delà de #70 ne se découvrent que par effets.

### 4.5 Ressources

- Invisibles et éphémères : **toutes perdues dès qu'une nouvelle carte entre en zone de jeu ou à la fin du tour**.
- L'UI doit prévenir avant une action qui ferait perdre des ressources (ex. Avancer avec des ressources non dépensées).

### 4.6 Concepts clés

- **Timing** : effets simultanés, le joueur choisit l'ordre mais doit tous les résoudre, même si la carte source est défaussée entre-temps. Les cartes jouées ensemble (4 en début de tour, 2 en avançant) sont toutes en jeu au moment de résoudre les effets "when played".
- **Cartes permanentes** : jamais dans le deck, jamais défaussées, toujours actives, mais **pas "en jeu"**. Affichées au-dessus de la zone de jeu.
- **Blocage** : la carte bloquée passe sous la bloquante et n'existe plus. Si la bloquante est défaussée en fin de tour/manche, la bloquée aussi. Si elle est défaussée pendant le tour, la bloquée est libérée en zone de jeu (sans être "jouée", donc pas de "when played").
- **Destruction** : définitive. **Reset possible avant la découverte de #23** : en numérique, conserver un snapshot de la partie tant que #23 n'est pas découverte et proposer "Recommencer le royaume".
- **Manipulation du deck** (dessus/dessous) : impossible si deck vide.
- **Stickers** : uniquement sur le stage actif, sauf mention contraire.
- **Booster la production** : choisir une ressource déjà produite par la carte, +1 via sticker.
- **Slash "/"** = OU, choix du joueur.
- **Reset d'une carte** : retour au stage de départ (sceau en haut).
- **Cartes à flèches en haut** : à la découverte, choisir la face visible.
- **Cases à cocher** : cocher une case libre ; si elle contient une icône, l'appliquer (ressource = gain). Cocher une case sur une autre carte déclenche les mêmes effets que si cette carte l'avait cochée.
- **Stay in play** : reste entre les tours, mais défaussée si on produit avec, si on utilise son effet, ou en fin de manche. Un "stay in play" passif s'applique à chaque tour.
- **Découvrir** : la carte va dans la **défausse**. Si choix entre plusieurs cartes : voir toutes les options, en choisir une, les autres retournent dans la boîte. **Dé-découvrir** : reset puis retour dans la boîte.
- **Portée des effets** : par défaut, cartes en jeu seulement (pas les permanentes). "Kingdom" = deck + jeu + défausse + permanentes, mais jamais les cartes bloquées.
- **Ennemis** : vaincre = selon la carte (détruire, retourner, cocher). Sans instruction de défaite, impossible à vaincre (mais destructible par d'autres effets).
- **Équipement** (bandeau "Equip X") :
  - Non équipé : ni production ni effets, mais compte comme carte en jeu (mots-clés, gloire), améliorable.
  - Équiper = action (pas en réaction à un effet). Se place sous une carte ayant le mot-clé requis.
  - Équipé : ne compte plus comme carte, sa production/gloire/mots-clés/effets s'ajoutent au porteur (ex. personne 3 gloire + équipement 5 = 8).
  - Si le porteur est bloqué/détruit, l'équipement aussi. Si le porteur change d'orientation ou quitte la zone de jeu, l'équipement est défaussé.
  - Rayer la production du porteur raye aussi celle de l'équipement.
  - Un équipement équipé ne peut ni être amélioré, ni déséquipé, ni rééquipé.
- **Tab** : sticker qui dépasse de la carte, donc **visible dans le deck** (afficher l'indicateur sur la pile).

### 4.7 Extensions

> Dans le périmètre actuel : **la purge et les 3 mini-extensions (136, 137, 138)**, jouables une fois la partie de base terminée. Les grandes extensions ne sont pas encore scrappées : la partie de cette section qui les concerne sert de cible pour ne pas fermer de portes dans l'architecture.

- Après la partie de base, jusqu'à 10 extensions, une à la fois, **chacune une seule fois par royaume**.
- **Mini-extensions** (cartes 136, 137, 138) : choisir l'une, faire une **purge 12** + **purger 1 carte permanente**, puis 4 manches **sans découverte de 2 cartes par manche**. À la fin, sticker 13k sur le chemin de score + nouveau score.
- **Grandes extensions** : nouvelles cartes et concepts, données dans `./data/cards/{Extension}`, règles additionnelles à intégrer extension par extension (me demander les règles spécifiques ou les extraire de leurs fiches).
- **Purge N** : mélanger le deck, le parcourir par paquets de N, choisir 1 carte **amie** à purger par paquet, jusqu'à ce qu'il reste moins de N cartes. "Purger une permanente" : choix libre parmi les permanentes amies. Exclure les cartes "cannot be destroyed/purged" et celles protégées par d'autres effets. Enfin : sommer la gloire des cartes purgées → sticker 16 "Purged Fame", puis détruire ces cartes. Cette gloire compte dans tous les scores futurs.
- Le **suivi du royaume** (score path, extensions jouées, gloire purgée cumulée) est stocké avec la campagne.

---

## 5. DSL d'effets

### 5.1 Approche hybride

1. **DSL JSON** pour ~80 % des effets (documenté dans `docs/CARD_DSL.md`).
2. **Scripts TS par carte** (`src/engine/scripts/{templateId}.ts`) pour les cas trop spécifiques.
3. **Fallback manuel** : si un effet n'est ni en DSL ni scripté, l'UI affiche son texte et ouvre des **outils de résolution manuelle** (gagner/perdre ressource, cocher, déplacer une carte, tourner, ajouter un sticker, découvrir n°X). Le jeu ne doit **jamais être bloqué**.

### 5.2 Types d'effets (icônes du jeu)

| Type | Comportement |
|---|---|
| `passive` | S'applique toujours, ou utilisable à volonté |
| `activated` | Défausser la carte pour l'appliquer |
| `time` | Défausser la carte (sauf permanente) **et finir le tour** |
| `destroy` | Détruire la carte pour l'appliquer |
| `triggeredOptional` | Possible quand le déclencheur arrive, ne défausse pas sauf mention |
| `triggeredForced` | Idem mais obligatoire |
| `oneTime` | Une fois résolu, rayé définitivement |

### 5.3 Briques du DSL (à affiner)

- **Déclencheurs** : `whenPlayed`, `endOfTurn`, `endOfRound`, `onDiscover`, `onUpgrade`, `onDefeat`, `onProduce`...
- **Coûts** : ressources, défausser N cartes (filtre), défausser / détruire soi-même.
- **Actions** : `gain`, `spend`, `produce`, `discover(serial | choice[])`, `undiscover`, `destroy`, `rotate`, `flip`, `reset`, `addSticker`, `boostProduction`, `markCheckbox`, `block`, `placeOnTop`, `placeOnBottom`, `playCards(n)`, `purge(n)`, `discard`, `defeat`, `crossOut`, `tab`, `endTurn`...
- **Sélecteurs** : zone (`inPlay`, `kingdom`, `discard`, `deck`, `permanent`), mot-clé, `friendly`/`negative`, stage, "autre que soi".
- **Conditions** : nombre de cartes avec mot-clé, ressources possédées, case cochée, etc.
- **Choix** : `choose(options)` → décision en attente.

Chaque effet porte aussi son `text` original pour affichage.

---

## 6. Royaumes (sauvegardes) et persistance

### 6.1 Royaumes multiples

Un **royaume** = une partie indépendante, avec sa propre boîte virtuelle de 140 cartes. Ce qui arrive aux cartes d'un royaume (stickers, destructions, orientations) n'affecte jamais les autres. C'est l'équivalent numérique d'avoir plusieurs boîtes du jeu.

**Écran d'accueil "Mes royaumes"** (premier écran de l'appli) :
- Liste des royaumes sous forme de cartes : nom, blason/emoji, date de dernière partie, manche en cours, dernière carte découverte (numéro seulement), gloire actuelle, statut (en cours / terminé / extension en cours).
- Tri par dernière partie, recherche si la liste grandit.
- Bouton **"Nouveau royaume"** : nom (proposer un nom aléatoire médiéval), emoji, mode d'annulation (Strict / Libre), graine aléatoire ou saisie manuelle.
- Actions par royaume (menu "…" ou appui long) :
  - **Continuer**
  - **Renommer**, changer l'emoji
  - **Dupliquer** : copie complète à l'instant T (pour tester une stratégie sans risquer l'original, ou garder un point de sauvegarde)
  - **Créer un point de sauvegarde** nommé (snapshot), et **restaurer** un point existant (avec confirmation)
  - **Exporter** (fichier JSON) / **Importer**
  - **Supprimer** (confirmation forte)
  - Voir l'**historique** : scores, manches jouées, cartes découvertes, journal complet
- Un royaume dont la partie de base est terminée propose **"Jouer une mini-extension"** (136, 137 ou 138, celles déjà jouées sont grisées), en commençant par l'écran de purge. Le score path du royaume affiche le score de base puis le score après chaque extension.
- Un royaume entièrement terminé reste consultable (royaume final, décomptes, journal).

### 6.2 Persistance

- Chaque royaume est stocké séparément dans IndexedDB (métadonnées + état + journal d'actions + snapshots).
- **Autosave** après chaque action.
- Quitter une partie à tout moment (même en plein tour) et reprendre exactement au même point.
- **Undo** : mode "Strict" (annulation uniquement dans le tour en cours, avant toute info nouvelle révélée) et mode "Libre" (illimité). Mode réglable par royaume.
- **Snapshot pré-#23** pour le reset officiel.
- **Export/Import JSON** d'un royaume (sauvegarde manuelle, transfert iPad ↔ ordinateur).
- Historique des scores.

---

## 7. Interface

### 7.1 Cibles d'écran

**Cibles uniques pour l'instant : iPad et ordinateur.** Le téléphone est hors périmètre (ne pas optimiser pour, mais ne rien faire qui l'empêcherait plus tard).

| Appareil | Résolution CSS de référence | Orientation |
|---|---|---|
| iPad mini | 744 × 1133 | paysage prioritaire, portrait supporté |
| iPad / iPad Air 11" | 820-834 × 1180-1194 | paysage prioritaire, portrait supporté |
| iPad Pro / Air 13" | 1024 × 1366 | paysage prioritaire, portrait supporté |
| Ordinateur | ≥ 1280 de large | fenêtre redimensionnable |

- Largeur minimale supportée : **744 px**. En dessous (Slide Over, fenêtre très étroite), afficher un écran "Agrandis la fenêtre" plutôt qu'une mise en page dégradée.
- Tester explicitement : iPad paysage, iPad portrait, iPad en Split View 2/3, ordinateur 1280 × 800 et 1920 × 1080.
- Navigateurs : **Safari iPadOS** (prioritaire, WebKit) et Chrome/Safari/Firefox desktop.

### 7.2 Principes

- On voit toujours, **sans scroll** : carte du dessus du deck, nombre de cartes deck/défausse, ressources en cours, permanentes, zone de jeu complète (jusqu'à ~10 cartes en jeu sans défilement en paysage).
- Les cartes sont **assez grandes pour lire leur texte sans zoomer** sur iPad en paysage : c'est le critère de dimensionnement principal.
- **L'UI propose uniquement les actions légales** et affiche pourquoi une action est impossible (ex. "Il manque 1 bois").
- Rien de caché dans la boîte n'est jamais visible (règle d'or 2).
- Un seul code avec mises en page adaptées : **paysage (iPad + ordi)** comme référence, **portrait iPad** comme variante.

### 7.3 Mises en page

**Paysage (iPad paysage et ordinateur) : référence**

```
┌───────────────────────────────────────────────────────────────┐
│ ☰ Royaume "Vallombre" · Manche 6 · Tour 2 · Gloire 34   ⟲  ⚙  │
├───────────────────────────────────────────────────────────────┤
│ Permanentes (bande horizontale, vignettes, tap = détail)       │
├─────────┬───────────────────────────────────────┬─────────────┤
│  DECK   │                                       │  DÉFAUSSE   │
│ carte du│         ZONE DE JEU                   │ dernière    │
│ dessus  │   grille adaptative, cartes lisibles  │ carte       │
│ visible │                                       │ + compteur  │
│ + tabs  │                                       │             │
│ + nb    │                                       │ (tap=liste) │
├─────────┴───────────────────────────────────────┴─────────────┤
│ Ressources : [coin 2] [wood 1] [stone 0] ...  [Avancer] [Passer]│
└───────────────────────────────────────────────────────────────┘
```
- **Journal** : panneau latéral droit repliable (ouvert par défaut sur ordi ≥ 1440 px, fermé sur iPad).
- La taille des cartes s'ajuste à l'espace (grille CSS `auto-fit` avec taille min. garantissant la lisibilité). Au-delà de la capacité, la zone de jeu passe en deux rangées serrées avec léger chevauchement, jamais de scroll horizontal.
- Feuille d'actions d'une carte : **popover** ancré à la carte (pas une modale plein écran).

**Portrait (iPad portrait)**
- Haut : barre d'info + permanentes.
- Centre : zone de jeu (grille 3 colonnes).
- Bas : bande fixe avec deck (carte du dessus), ressources, boutons Avancer/Passer, défausse.
- Journal en panneau qui monte du bas.

**Écran "Mes royaumes"** : grille de cartes de royaumes (3-4 colonnes en paysage, 2 en portrait).

### 7.4 Rendu des cartes

- Utiliser les images scrappées. Afficher la carte **dans son orientation réelle** : le stage actif en haut lisible, le stage suivant tête en bas comme sur la vraie carte.
- Option d'affichage "lecture facile" : stage actif en grand + texte de l'effet en clair avec icônes inline (tokens `{coin}`, `{wood}`... rendus en icônes).
- Overlays : stickers posés (pastilles), cases cochées, effets/production rayés, équipement visible sous le porteur (décalé), carte bloquée sous la bloquante, tab qui dépasse.
- Couleur du bandeau = catégorie (Building gris, Person jaune, Seafaring bleu, Land vert, Livestock orange, Other rose, Negative rouge).

### 7.5 Interactions

- **Tap sur une carte** → feuille d'actions contextuelle : Produire (avec aperçu du gain), Améliorer (chaque option avec coût, affordabilité, stage cible et mention "fin du tour"), effets utilisables, Équiper.
- **Appui long** → inspection plein écran : les 4 stages (recto/verso), zoom par pincement. Autorisé seulement pour cartes en jeu et défausse (et permanentes, deck en main).
- **Gestes optionnels** (toujours doublés par des boutons) : glisser une carte vers la défausse = Produire ; glisser vers une autre carte = Équiper.
- **Décisions en attente** : modale ou bottom sheet claire (choisir une cible = cartes éligibles en surbrillance, autres grisées ; choix d'une ressource dans un "/" ; ordre de résolution par glisser-déposer).
- **Confirmations** uniquement pour l'irréversible : détruire, purger, effet one-time, et toute action qui ferait perdre des ressources non dépensées. Sinon, **toast "Annuler"** de quelques secondes.
- **Défausse** : tap → liste consultable de toutes les cartes défaussées (autorisé).

### 7.6 Tactile, iPad et ergonomie

- **Tout fonctionne au doigt, à la souris, au trackpad et à l'Apple Pencil** (Pointer Events). Aucune info ni action accessible uniquement au survol ; le survol (souris, trackpad iPad) peut seulement **ajouter** un aperçu.
- Cibles tactiles ≥ 44 px.
- Pas de délai au tap, `touch-action` réglé pour bloquer le double-tap zoom et le scroll élastique sur le plateau ; pinch-zoom conservé dans l'inspecteur de carte.
- Désactiver la sélection de texte et le menu contextuel iOS (appui long) sur les cartes, pour que l'appui long serve à l'inspection : `-webkit-user-select: none`, `-webkit-touch-callout: none`.
- Pas de haptique (non supporté par Safari iPadOS) : retour visuel et sonore léger à la place (sons désactivables).
- Safe areas respectées (`env(safe-area-inset-*)`), notamment en PWA plein écran.
- **Clavier** (ordi et iPad avec Magic Keyboard) : A = Avancer, P = Passer, U / Cmd+Z = Annuler, 1-9 = sélectionner une carte en jeu, Entrée = valider, Échap = fermer.
- Clic droit (ordi) = inspection, équivalent de l'appui long.
- Thème clair/sombre, taille de texte réglable.
- Accessibilité : labels ARIA sur cartes et ressources, contraste suffisant.

### 7.6 bis Spécificités Safari / PWA iPad

- PWA installable via "Sur l'écran d'accueil" : manifest complet, icônes Apple (`apple-touch-icon`), `apple-mobile-web-app-capable`, mode `standalone`, couleur de barre d'état.
- **Persistance des sauvegardes** : Safari peut effacer les données d'un site non installé après une période sans visite. Donc :
  - demander `navigator.storage.persist()` au premier lancement ;
  - afficher un bandeau conseillant d'installer la PWA si elle tourne dans un onglet ;
  - rappel périodique discret d'**exporter** ses royaumes (et export en un clic de tous les royaumes).
- Mettre en cache toutes les images de Feudal Kingdom à l'installation (jeu 100 % hors ligne).

### 7.7 Moments forts (soigner l'animation)

- **Découverte** : la carte sort de la "boîte" et se révèle, avec son numéro ; écran dédié pour les **parchemins** (lecture confortable, puis destruction animée).
- **Amélioration** : animation de rotation 180° ou de retournement 3D, puis glissement vers la défausse.
- **Destruction** : animation de déchirement/brûlure (clin d'œil à la règle).
- **Fin de manche** : récap (cartes découvertes, gloire actuelle).
- **Fin de partie / d'extension** : décompte de gloire carte par carte, mise à jour du score path.

### 7.8 Journal

Chaque action en une ligne lisible avec icônes ("Tour 3 : Wild Grass produit {coin}", "Upgrade Forest → Felled Forest, fin du tour"). Filtrable, utile pour vérifier les règles.

---

## 8. Cartes et extensions maison

- Même format que les cartes officielles, dans `./data/custom/{Extension}/`.
- Les images peuvent être générées : **rendu procédural** d'une carte à partir de ses données (cadre, bandeau couleur, nom, icônes de production, texte, boîtes d'upgrade) si aucune image n'est fournie.
- **Éditeur de cartes intégré** (phase tardive) : formulaire par stage, prévisualisation en direct, validation Zod, export JSON.
- Possibilité d'insérer des cartes custom dans la découverte (ex. extension maison avec sa propre séquence de manches).
- Un champ `origin: "official" | "custom"` sur chaque template.

---

## 9. Outils de dev

- **Mode bac à sable** : lancer une partie avec n'importe quelles cartes, donner des ressources, forcer une orientation, découvrir une carte précise. Indispensable pour tester les effets.
- **Visionneuse de données** : liste de toutes les cartes, filtres (extension, `to_verify`, effets non implémentés), vue des 4 stages avec données à côté de l'image pour vérifier l'extraction.
- **Rapport de couverture** : % d'effets en DSL / script / manuel par extension.

---

## 10. Tests

- Un test par règle d'or et par concept clé de la section 4.
- Cas à couvrir au minimum :
  - Une rotation par effet (ex. Forest) ne termine pas le tour mais défausse la carte.
  - Une amélioration termine le tour.
  - Ressources perdues quand une carte entre en jeu (Avancer).
  - "When played" : toutes les cartes jouées ensemble sont en jeu à la résolution.
  - Blocage : bloquée défaussée avec la bloquante en fin de tour, libérée si défausse en cours de tour, sans déclencher "when played".
  - Équipement : 3 + 5 = 8 gloire ; production cumulée ; défausse si le porteur change d'orientation.
  - Sticker refusé à 9+ de production.
  - Parchemin en début de manche.
  - Découverte de #68 → dernière manche → score.
  - Purge 12 avec exclusions, gloire purgée comptée dans le score.
  - Mini-extension : pas de découverte de 2 cartes par manche, 4 manches.
- **Scénarios** : parties scriptées (graine fixe + liste d'actions) rejouées et vérifiées.
- Test de validation : toutes les cartes de `./data/cards` passent le schéma Zod.

---

## 11. Performance

- Images en WebP, plusieurs tailles (vignette / plein écran), lazy loading, préchargement des cartes du deck.
- 60 fps sur un iPad d'entrée de gamme récent : animations en `transform`/`opacity` uniquement.
- Chargement initial rapide : données des cartes découpées par extension.

---

## 12. Phases

1. **P0 Données** : schémas Zod (section 3), chargement de `./data/cards/FeudalKingdom`, visionneuse de données. Adapter le script d'extraction du scraper à ce schéma.
2. **P1 Moteur cœur** : setup, tours, manches, 5 actions, ressources, règles d'or, décisions en attente, undo, avec les cartes 1 à 10 seulement. Jouable en CLI + tests.
3. **P2 UI minimale + royaumes + déploiement** : `npm run deploy` vers `gh-pages`, écran "Mes royaumes" (créer, continuer, dupliquer, supprimer), plateau responsive, feuille d'actions, inspection, autosave. Partie jouable de bout en bout sur iPad (paysage et portrait) et ordinateur.
4. **P3 Feudal Kingdom complet** (0-135) : DSL d'effets, scripts, fallback manuel, stickers, parchemins, ennemis, blocage, équipement, fin de partie et score. Points de sauvegarde, export/import.
5. **P4 Mini-extensions** : purge (purge 12 + purge d'une permanente, gloire purgée), mini-extensions 136, 137, 138 (choix sur l'écran du royaume une fois la partie de base terminée, 4 manches sans découverte de 2 cartes, score path mis à jour, chacune jouable une seule fois par royaume).
   Grandes extensions : plus tard, sur ma demande, une par une.
6. **P5 Finitions** : animations, haptique, PWA hors ligne, thèmes, raccourcis, journal soigné.
7. **P6 Création** : rendu procédural de cartes, éditeur, extensions maison.

À chaque phase : je teste en parallèle avec le jeu physique, et les écarts deviennent des tests.

---

## 13. Déploiement : GitHub Pages depuis une branche

### 13.1 Principe

- Déploiement via **GitHub Pages, mode "Deploy from a branch"**, branche **`gh-pages`**, dossier `/ (root)`.
- `main` contient le code source ; `gh-pages` ne contient que le build (`dist/`).
- Script `npm run deploy` : build Vite puis publication de `dist/` sur la branche `gh-pages` (paquet npm `gh-pages`). Pas besoin de `gh` ni de GitHub Actions.
- Config Vite : `base: "/KLeg_Fantasy/"` (nom exact du dépôt GitHub, sensible à la casse). Manifest PWA : `start_url` et `scope` alignés sur ce chemin. Ajouter un fichier `.nojekyll` dans le build.
- Routage : pas de routes serveur (GitHub Pages ne gère pas les réécritures). Utiliser un routage par hash (`#/royaumes`, `#/partie/:id`) ou un état interne.
- `docs/DEPLOY.md` : étapes pour activer Pages (Settings > Pages > Source : Deploy from a branch > `gh-pages` / root) et lancer un déploiement.

### 13.2 Données des cartes embarquées dans le site

- Les cartes validées (`data/cards`) et les images optimisées (WebP) sont **versionnées dans le dépôt et incluses dans le build** : le site publié est jouable immédiatement, sans import.
- `data/raw` (cache brut du scraper) et les images originales non optimisées restent dans `.gitignore`.
- Les données sont découpées par extension et chargées à la demande ; le service worker de la PWA met en cache toutes les images de Feudal Kingdom à l'installation (jeu 100 % hors ligne).
- Mise à jour des cartes (corrections) : nouveau déploiement ; les royaumes existants restent compatibles (référence aux cartes par `templateId`). Afficher un rapport des cartes modifiées au premier lancement après mise à jour.
- Les cartes **custom** sont incluses de la même façon (dossier `data/custom`).
- Ajouter `<meta name="robots" content="noindex">` et un `robots.txt` qui interdit l'indexation.

### 13.3 Test sur iPad pendant le dev

- `npm run dev -- --host` : l'iPad ouvre l'adresse locale du Mac sur le même Wi-Fi.
- Une fois la PWA publiée et installée sur l'iPad, le jeu fonctionne hors ligne ; les sauvegardes restent sur l'appareil (export/import pour passer de l'iPad à l'ordinateur).
