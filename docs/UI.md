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
- **Traduction** : au survol d'une carte, bulle avec le nom et le texte en français du stage pointé (moitié haute =
  stage actif, moitié basse = stage suivant). Sur iPad, la traduction du stage actif est dans la feuille d'actions.
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
- **Zone neutre** d'une carte : bulle de traduction de la moitié touchée, si FR est activé (sinon rien). La feuille d'actions ne s'ouvre que pour un choix (ex. Bazaar).
- **Appli iPad** : `public/manifest.webmanifest`, icônes pièce sur fond noir (`scripts/make-app-icons.ts`).
- **Tri ⇅** : cartes en jeu par ressource (défaut), par type de terrain ou ordre d'arrivée (`sortCards.ts`, affichage seulement).
- **Stats** : cartes par zone, par étape (1 à 4), production par ressource, gloire, types (en anglais), découvertes / détruites / boîte ; cases colorées (`engine/stats.ts`).
- **Inspection** : face visible telle qu'elle est posée + autre face retournée de haut en bas (1 en haut ↔ 3 en haut).
- **Réglages ⚙** : thème Auto / Clair / Sombre (data-theme sur <html>), zoom des cartes en jeu seulement (60 à 200 %, la zone défile au besoin) et grisage de la moitié basse des cartes.
- **Mises à jour** : l'appli compare sa version à `version.json` (publié au build) au démarrage, au retour au premier plan
  et toutes les 15 min ; un bouton recharge la page en contournant le cache (utile pour l'appli installée sur l'iPad).
- **Icônes** : ressources, gloire et stickers détourés de la planche fournie (`data/icons/stickers-sheet.webp`, `scripts/extract-sheet-icons.ts`) ; types d'effet découpés dans les cartes (`scripts/extract-icons.ts`).
- **Pas de textes explicatifs** dans l'interface (demande du 2026-10-02).
- **Version** affichée en bas de « Mes royaumes » et dans la barre de la partie (`src/version.ts`, `CHANGELOG.md`).
- **Clavier** : A = Avancer, P = Passer, U ou Cmd+Z = Annuler, Échap = fermer.
- Zone de jeu sans défilement : la taille des cartes s'adapte au nombre de cartes (`fitCards.ts`).
- Paysage et portrait : même disposition, deck, boutons et défausse dans la bande du bas.
- **Signaler un bug ou une idée** (⚙, et bas de l'accueil) : ticket GitHub pré-rempli (`common/feedback.ts`).
- En dessous de 744 px de large : message « Agrandis la fenêtre ».

## Sauvegarde

`src/persistence/` : un royaume = enregistrement (config + actions) + dernier état, dans IndexedDB (Dexie), écrit après chaque action.
La reprise ne rejoue pas la partie. L'annulation garde les 40 derniers états en mémoire ; au-delà (mode Libre), elle rejoue l'enregistrement.
Au premier lancement, le site demande au navigateur de ne pas effacer ses données (`navigator.storage.persist`).
