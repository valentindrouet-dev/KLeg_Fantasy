# Extraction des cartes

Chaîne : `npm run scrape` → `data/raw/` (HTML en cache, JSON brut, images JPEG, hors dépôt) → lecture visuelle des images par lots d'environ 10 cartes → `data/cards/{Expansion}/{n}.json` (schéma `src/data/schema.ts`) → `npm run images` (WebP dans `data/images/`) → `npm run validate`.

## Ce que donne le site

- HTML rendu côté serveur, pas de `robots.txt`. Crawl limité à 1 requête par seconde, avec cache.
- Par carte : description, et par stage un texte d'aide et une liste de mots-clés de glossaire (type d'effet, Permanent, Stays in play...).
- Le nom n'est fiable que pour le stage 1 ; les autres sont des libellés génériques (`Card 01 Stage 2`). Les noms, coûts, productions, gloire, flèches et cases viennent des images.
- Les images sont celles de la dernière impression (373 × 520 px). Les `VERSION NOTE` du site signalent les écarts avec les impressions précédentes : ils sont reportés dans `to_verify`.

## Orientation

- Rotation 0 = image du site à l'endroit, sceau (numéro) en haut.
- Recto : stage 1 en haut, stage 2 tête en bas. Verso : stage 4 en haut, stage 3 tête en bas.
- Cartes à une seule étape par face (image pleine) : le site numérote le verso « 4 » et les fiches gardent ce numéro ; l'appli l'affiche « 2 » (`printedStage`, décision du 2026-10-02).
- Flèche verticale = `rotate` (même face, rotation 180°). Flèche horizontale = `flip` (autre face, même rotation). Le `toStage` de chaque amélioration est écrit explicitement dans la fiche.

## Conventions des fiches

- Une fiche par numéro de carte, même quand plusieurs cartes sont identiques (1 à 4 Wild Grass, 5/6/15/35/71 Distant Mountain, 7/8/19/72 Forest...) : chaque carte physique a son image et son numéro.
- `production` : un groupe par production imprimée, `options` porte le « / ». Chaque option liste ses icônes une par une.
- `upgrades[].cost` : icônes de ressources de la boîte marron, une par une. Coût d'une autre nature (« 2 Persons », « Destroy Stone Bridge ») : `otherCost` (texte). Boîte sans icône : amélioration gratuite (`cost` vide).
- Un changement de stage imposé par un texte (« Then ↓ ») reste un effet, pas une amélioration.
- `text` : texte imprimé complet du stage. `effects[]` : découpage par effet, avec son type (icône imprimée). `oneTime: true` quand l'icône « usage unique » accompagne un autre type. Les marqueurs (`staysInPlay`, `permanent`...) ne sont pas répétés dans `effects`.
- `fame` : gloire fixe imprimée. `fameVariable: true` quand le ruban porte « * » ou quand un texte ajoute de la gloire (cartes de piste, objectifs, « Worth 2 per case »).
- `checkboxes[]`, de gauche à droite puis de haut en bas : `gain` (ressources imprimées dans la case), `cost` (ressources à dépenser, cartes de piste), `fame` (gloire de la case), `threshold` (seuil d'Export), `icon` (astérisque), `text` (effet associé).
- `defeat` : pour les ennemis, type de défaite (`destroy`, `turn`) et coût en épées. Absent = pas d'instruction de défaite.
- Icônes dans les textes : `{coin}` `{wood}` `{stone}` `{metal}` `{sword}` `{tradeGood}` (ressources de `data/resources.json`), `{rotate}` `{flip}` `{mark}` `{asterisk}` `{negative}` `{fame}`, et les types d'effet `{passive}` `{activated}` `{time}` `{destroy}` `{triggeredOptional}` `{triggeredForced}` `{oneTime}`.
- `category` : couleur du bandeau. `none` pour les cartes sans bandeau (parchemins, cartes de piste), `goal` pour les objectifs (bandeau jaune, mais pas des personnes). Bandeau bicolore : la première couleur. Les tests de règles (« person », « land »...) s'appuient sur `keywords`, pas sur `category`.
- `isParchment` : fond parchemin (0, 23, 24, 30, 37, 47, 68, 139). `chooseSideOnDiscover` : flèches rouges en haut de la carte.
- `siteKeywords` et `helpText` : repris tels quels du site (HTML compris), pour la visionneuse.
- Tout doute va dans `to_verify` (en français, une phrase par point) et fait baisser `confidence`. Les `VERSION NOTE` du site y sont recopiées.

## Recoupements faits

- Types d'effet lus sur l'image comparés au glossaire du site, stage par stage ; les écarts sont notés dans `to_verify`.
- Toutes les références « Discover X (n) » pointent vers une carte dont le contenu correspond.
- Les petites icônes ambiguës (cases, coûts en épées) ont été relues sur agrandissement.
