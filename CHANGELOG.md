# Journal des versions

Chaque mise à jour publiée change de version (`package.json`, affichée dans l'appli en bas de l'écran « Mes royaumes »
et dans la barre de la partie). Convention : `0.5.0` s'affiche **v0.05** ; un correctif `0.5.1` s'affiche **v0.05.1**.

## v0.05 (2 octobre 2026)

- Améliorer une carte ne demande plus de confirmation.
- Animation des changements d'orientation : rotation de 180° (↓) ou retournement de la carte (→), avant qu'elle parte à la défausse.
- Numéro d'étape (1 à 4) dans le coin inférieur gauche de chaque moitié de carte.
- Numéro de version affiché dans l'appli, et ce journal.

## v0.04 (2 octobre 2026)

- Traduction française des 140 cartes, au survol du stage pointé (et dans la feuille d'actions sur iPad).
- Cartes « engagées » : toucher la ressource d'une carte la réserve sans la défausser ; elle ne produit qu'au paiement. Avancer ne fait donc rien perdre.
- Zones cliquables sur les cartes : ressource, boîte d'amélioration, effet ; toucher la pioche = Avancer.

## v0.03 (2 octobre 2026)

- Écran « Mes royaumes » (créer, continuer, renommer, dupliquer, recommencer, supprimer) et sauvegarde automatique.
- Plateau de jeu iPad (paysage et portrait) et ordinateur : feuille d'actions, inspection, décisions, journal, fin de partie.
- Correctif : page blanche après une mise à jour (fichiers en cache).

## v0.02 (2 octobre 2026)

- Moteur de règles (phase P1) : tours, manches, actions, découvertes, dernière manche (carte 68), score, annulation.
- Partie en ligne de commande (`npm run play`).
- Catalogue des stickers, déploiement automatique sur GitHub Pages (branche `gh-pages`).

## v0.01 (2 octobre 2026)

- Données (phase P0) : 140 fiches de cartes, 280 images WebP, visionneuse des cartes.
