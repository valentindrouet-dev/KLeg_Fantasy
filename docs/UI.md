# Interface (phase P2)

Routage par hash (`src/ui/App.tsx`) : `#/` Mes royaumes, `#/partie/<id>` partie, `#/cartes` visionneuse de données.

## Écrans

| Écran | Fichiers | Contenu |
|---|---|---|
| Mes royaumes | `src/ui/kingdoms/` | Liste triée par dernière partie (recherche au-delà de 6), nouveau royaume (nom aléatoire, blason, annulation Stricte/Libre, graine), continuer, renommer, dupliquer, recommencer (avant la carte 23), supprimer |
| Partie | `src/ui/game/GameScreen.tsx` | Barre du haut (royaume, manche, tour, gloire, annuler, journal), permanentes, deck (carte du dessus visible), zone de jeu, défausse, ressources, Avancer / Passer |
| Visionneuse | `src/ui/viewer/` | Vérification des fiches (P0) |

## Interactions (spec 7.5 et 7.6)

- **Tap** sur une carte en jeu : feuille d'actions ancrée à la carte. Seules les actions légales sont cliquables ;
  les améliorations impossibles affichent la raison (« Il manque … »), les effets non automatisés sont signalés.
- **Appui long** ou **clic droit** : inspection des deux faces (cartes en jeu, défausse, permanentes ; jamais la boîte).
- **Défausse** : tap pour voir toute la pile.
- **Décisions** (parchemin, choix de découverte, choix de face) : fenêtre bloquante tant que le choix n'est pas fait.
- **Confirmation** avant une action qui ferait perdre des ressources non dépensées, une destruction ou un effet à usage unique ;
  sinon un message « Annuler » de 4 secondes.
- **Clavier** : A = Avancer, P = Passer, U ou Cmd+Z = Annuler, Échap = fermer.
- Zone de jeu sans défilement : la taille des cartes s'adapte au nombre de cartes (`fitCards.ts`).
- Portrait iPad : deck, ressources et défausse passent dans la bande du bas ; journal en panneau qui monte du bas.
- En dessous de 744 px de large : message « Agrandis la fenêtre ».

## Sauvegarde

`src/persistence/` : un royaume = enregistrement (config + actions) + dernier état, dans IndexedDB (Dexie), écrit après chaque action.
La reprise ne rejoue pas la partie. L'annulation garde les 40 derniers états en mémoire ; au-delà (mode Libre), elle rejoue l'enregistrement.
Au premier lancement, le site demande au navigateur de ne pas effacer ses données (`navigator.storage.persist`).
