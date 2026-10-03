# Interface (phases P2 et retours)

Routage par hash (`src/ui/App.tsx`) : `#/` Mes royaumes, `#/partie/<id>` partie, `#/cartes` visionneuse de données.

## Écrans

| Écran | Fichiers | Contenu |
|---|---|---|
| Mes royaumes | `src/ui/kingdoms/` | Liste triée par dernière partie (recherche au-delà de 6), nouveau royaume (nom aléatoire, blason, annulation Stricte/Libre, graine), continuer, renommer, dupliquer, recommencer (avant la carte 23), supprimer |
| Partie | `src/ui/game/GameScreen.tsx` | Barre du haut (royaumes, manche, tour, gloire, annuler, infobulles FR), permanentes, deck (carte du dessus visible), ressources non nulles au-dessus des cartes, zone de jeu, gros boutons Avancer / Passer centrés dessous, défausse ; message central à chaque nouvelle manche ; pas de journal |
| Visionneuse | `src/ui/viewer/` | Vérification des fiches (P0) |

## Interactions (spec 7.5 et 7.6, demandes du 2026-10-02)

- **Engager une carte** : toucher la zone de ressource d'une carte en jeu (sous le bandeau, à gauche) la marque « engagée ».
  Elle reste en jeu et ne produit qu'au moment de payer (amélioration, effet) : `planWithEngaged` choisit les cartes
  à produire (le moins possible, l'option du « / » qui convient). Les ressources, engagées ou déjà gagnées, ne se perdent
  qu'à la fin du tour (décision du 2026-10-02).
  La barre du bas affiche « 0 +2 » : ressources en cours + ressources des cartes engagées.
- **Zones cliquables** (`cardZones.ts`) : boîte d'amélioration → en haut à droite, boîte ↓ à droite contre la ligne
  du milieu, texte d'effet au centre ; toucher la zone fait l'action si elle est unique et payable. Au survol (souris,
  trackpad), la zone s'éclaire et une bulle annonce l'action.
- **Pioche** : toucher le deck = Avancer.
- **Mode FR** (bouton FR, demande du 2026-10-03) : toucher une carte pose la traduction de la moitié touchée sur la
  carte (`translationNote.ts`, `CardView.note`), sans jouer ; décocher FR l'efface. Plus d'infobulle au survol.
  Textes : `data/translations/FeudalKingdom.fr.json` (aide à la lecture, les fiches restent en anglais).
- **Ailleurs sur la carte** : feuille d'actions (engager, améliorations, effets payables avec les cartes engagées,
  raisons d'impossibilité).
- **Appui long** ou **clic droit** : inspection des deux faces (cartes en jeu, défausse, permanentes ; jamais la boîte).
- **Défausse** : toucher pour voir toute la pile.
- **Décisions** (parchemin, choix de découverte, choix de face) : fenêtre bloquante tant que le choix n'est pas fait.
- **Confirmation** avant de perdre des ressources déjà produites, une destruction ou un effet à usage unique ; jamais
  avant une amélioration (demande du 2026-10-02). Sinon un message « Annuler » de 4 secondes qui annule tout le geste.
- **Animations** : une carte qui change d'orientation tourne de 180° (↓) ou se retourne (→) avant de partir
  à la défausse (désactivées si le système demande moins d'animations).
- **Numéro d'étape** (1 à 4) en bas à gauche de chaque moitié de carte.
- **Effet à cible** : toucher l'effet, puis la carte visée (cartes possibles en surbrillance, les autres grisées) ;
  cible dans la défausse : choix dans la défausse. Échap annule.
- **Fin de tour animée** (`useCardMotion.ts`) : cartes vers la défausse, nouvelles cartes depuis la pioche.
- **Bouton FR** : active ou coupe les infobulles en français (mémorisé dans le navigateur).
- **Marque** : toucher une carte en jeu avec deux doigts (Alt + clic sur ordinateur) pose un contour bleu ; il tombe quand la carte quitte le jeu.
- **Sauvegarde** : bouton ⤓ dans la partie (fichier JSON) ; « Importer » ⤒ sur l'accueil (`persistence/backup.ts`, partie rejouée à l'import).
- **Messages** : aucun message après une action ni quand une action est impossible.
- **Zone neutre** d'une carte : rien. La feuille d'actions ne s'ouvre que pour un choix (ex. Bazaar).
- **Action impayable** : « Il manque … » posé sur la carte 4 s (note rouge).
- **Appli iPad** : `public/manifest.webmanifest`, icônes pièce sur fond noir (`scripts/make-app-icons.ts`).
- **Tri ⇅** : cartes en jeu par ressource (défaut), par type de terrain ou ordre d'arrivée (`sortCards.ts`, affichage seulement).
- **Stats** : cartes par zone, par étape (1 à 4), production par ressource, gloire, types (en anglais), découvertes / détruites / boîte ; cases colorées (`engine/stats.ts`).
- **Inspection** : face visible telle qu'elle est posée + autre face dans le même sens (1 à côté de 4, 2 à côté de 3 à l'envers).
- **Questions des effets** (`ChoiceDialog`) : la carte source, la question, puis des cartes à toucher, des ressources
  à choisir (une par toucher, retirer en touchant la sélection) ou des boutons d'option ; « Valider » quand plusieurs
  éléments ; « Annuler » tant que l'effet n'a rien coûté.
- **Cartes permanentes** : toucher ouvre leurs effets utilisables (Army, Treasury, Export…), sinon l'inspection.
- **Pastilles** (`engine/badges.ts`) : cartes bloquées, cases cochées, marchandises dépensées, gloire écrite, stickers.
- **Watchtower** en jeu : la deuxième carte de la pioche est montrée sous la pioche.
- **Nouvelles cartes** (début de manche) : fenêtre avec les cartes découvertes, « Mélanger dans le deck » (décision `newCards`).
- **Mélange animé** (`useCardMotion.ts`, `reshuffle`) : défausse → pioche, pioche battue, puis les cartes du tour.
- **Cartes bloquées** : sous leur bloquante, le haut dépasse de 18 % (`BLOCKED_PEEK`) ; la place est comptée par `fitSlots`.
- **Aucune confirmation** avant un geste (demandes du 2026-10-02) ; l'annulation reste dans la barre du haut.
- **Chemins vérifiés** (`tests/scenarios/uiPaths.test.ts`) : chaque action légale est proposée sur sa carte et
  payable par les cartes qui brillent. `planWithEngaged` produit carte par carte, dans tous les ordres (≤ 4 cartes).
- **Effets épuisés** (`engine/exhausted.ts`) : barrés au feutre (`.strike`) sur la bande de leur texte (27–47 % de la
  moitié, 58–88 % sur une carte à image pleine), plus proposés ni déclenchés.
- **Payer après coup** : effet ou amélioration touché sans assez de ressources → les cartes en jeu qui peuvent fournir
  ce qui manque brillent (`paymentCandidates`), les toucher les engage, l'action part dès que `planWithEngaged` la couvre.
- **Compteur de ressources** : un seul, fond gris ; par ressource, gagné ou engagé + production des autres cartes en jeu ;
  icône entourée de vert quand une partie est déjà gagnée.
- **Nouvelles cartes** : appui long sur une carte = inspection recto verso (l'inspection s'ouvre par-dessus les fenêtres).
- **Pistes** (Army, Treasury…) : pastille = coût de la case suivante et sa gloire ; Export : marchandises / palier.
  Toucher une carte permanente utilise son effet (ou le paiement après coup, ou le menu qui dit ce qui manque).
  Coût variable d'un effet : `EffectImpl.costOf`.
- **Fenêtres translucides** (`common.module.css`) : fond à 12 %, fenêtre à 62 % d'opacité.
- **Stickers** (`stickerLayout.ts`) : dessinés sur la moitié de leur stage, après les ressources imprimées
  (x = 4,5 % + 12,9 % par icône, y = 13,7 %, 11,8 % de large), à l'envers sur la moitié basse.
- **Cartes à image pleine** (`isFullImage`, `zoneAtCard`) : la moitié basse sert à l'effet ; traduction de l'étape unique.
- **Choix de découverte** à plus de 2 cartes : 2 par rangée (`pairWidth`).
- **Carte découverte** : vole du centre de l'écran vers la défausse (ou vers la pioche au mélange de début de manche).
- **Demi-cartes** (`showsTopHalfOnly`) : seulement les cartes « stays in play », jamais les cartes à image pleine.
  Zones cliquables ramenées à la carte entière.
- **Stats** : « Détruites » ouvre la liste des cartes détruites.
- **Ligne du haut** (`playLayout`) : ennemis, puis à 40 px d'écart les cartes « stays in play » ; seules sur leur ligne si
  les cartes y gardent au moins 75 % de leur taille, sinon en tête de rangée.
- **Réglages ⚙** : thème Auto / Clair / Sombre (data-theme sur <html>), zoom des cartes en jeu seulement (60 à 200 %, la zone défile au besoin) et grisage de la moitié basse des cartes.
- **Mises à jour** : l'appli compare sa version à `version.json` (publié au build) au démarrage, au retour au premier plan
  et toutes les 15 min ; un bouton recharge la page en contournant le cache (utile pour l'appli installée sur l'iPad).
- **Icônes** : ressources, gloire et stickers détourés de la planche fournie (`data/icons/stickers-sheet.webp`, `scripts/extract-sheet-icons.ts`) ; types d'effet découpés dans les cartes (`scripts/extract-icons.ts`).
- **Pas de textes explicatifs** dans l'interface (demande du 2026-10-02).
- **Version** affichée en bas de « Mes royaumes » et dans la barre de la partie (`src/version.ts`, `CHANGELOG.md`).
- **Clavier** : A = Avancer, P = Passer, U ou Cmd+Z = Annuler, Échap = fermer.
- Zone de jeu sans défilement : la taille des cartes s'adapte au nombre de cartes (`fitCards.ts`).
- Paysage et portrait : même disposition, deck, boutons et défausse dans la bande du bas.
- **Bouton bug** (barre du haut, partie et accueil ; `common/BugButton.tsx`) : description + enregistrement de la partie, état du moteur, ce qui était ouvert à l'écran et les 25 dernières lignes du journal, rangés dans IndexedDB (table `bugs`, `persistence/bugs.ts`). « Partager » (feuille de partage, sinon téléchargement) ou « Copier » donne un fichier `kleg-fantasy-bugs` : chaque `game.kingdom.record` se rejoue comme une sauvegarde, `game.state` est l'état au signalement.
- **« Non »** : un geste interdit par une carte en jeu fait trembler la carte responsable (`restrictionSources` : Dark Prince, Rain ; carte bloquée → sa bloquante).
- En dessous de 744 px de large : message « Agrandis la fenêtre ».

## Sauvegarde

`src/persistence/` : un royaume = enregistrement (config + actions) + dernier état, dans IndexedDB (Dexie), écrit après chaque action.
La reprise ne rejoue pas la partie. L'annulation garde les 40 derniers états en mémoire ; au-delà (mode Libre), elle rejoue l'enregistrement.
Au premier lancement, le site demande au navigateur de ne pas effacer ses données (`navigator.storage.persist`).
