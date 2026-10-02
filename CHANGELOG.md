# Journal des versions

Chaque mise à jour publiée change de version (`package.json`, affichée dans l'appli en bas de l'écran « Mes royaumes »
et dans la barre de la partie). Convention : `0.5.0` s'affiche **v0.05** ; un correctif `0.5.1` s'affiche **v0.05.1**.

## v0.09 (2 octobre 2026)

- Réglages (⚙) : zoom de l'interface (80 à 160 %) et option pour griser la moitié basse des cartes.
- Textes du plateau (deck, défausse, manche, tour) dans le style gras des boutons Avancer / Passer.
- Pioche et défausse plus grandes, surtout sur iPad.
- Recommencer un royaume : choix « Même graine » ou « Nouvelle graine ».
- Ressources en haut : icône et total, en plus gros.
- Numéros d'étape en couleur : 1 vert, 2 jaune, 3 orange, 4 rouge.
- Appli installée sur l'iPad : elle détecte les nouvelles versions et propose « mettre à jour ».
- Icônes détourées de ta planche (ressources, gloire, stickers 7, 8, 10, 11, 13k, 16).

## v0.08 (2 octobre 2026)

- Défausse : cartes plus grandes.
- Carte 23 : on voit les cartes 24 à 27, puis on choisit « Recommencer le royaume » ou « Continuer » (24 à 27 découvertes).
- Accueil : boutons alignés, centrés, à icônes (continuer, renommer, dupliquer, recommencer, supprimer, visionneuse, nouveau royaume).
- Le bouton FR reste utilisable quand une fenêtre de carte est ouverte.

## v0.07 (2 octobre 2026)

- Pioche et défausse plus grandes.
- Ressources affichées au-dessus des cartes, seulement celles que tu as (en cours + cartes engagées).
- Barre du haut : boutons carrés identiques avec icônes (royaumes, annuler, infobulles FR).
- Avancer et Passer : gros boutons centrés sous les cartes.
- Journal retiré.
- Nouvelle manche annoncée par un message central qui apparaît puis disparaît.

## v0.06 (2 octobre 2026)

- Bouton « FR » dans la barre de la partie pour activer ou couper les infobulles en français (mémorisé).
- Vraies icônes du jeu (pièce, bois, pierre, métal, épée, marchandise, ✓, sablier, ∞, case, détruire), découpées dans les cartes.
- Animations fluides : rotation d'un seul mouvement, vrai retournement à deux faces.
- Fin de tour animée : les cartes volent vers la défausse, les nouvelles glissent depuis la pioche.
- Cartes plus grandes dans les fenêtres (choix de face, découvertes, parchemins, inspection).
- Textes explicatifs retirés.
- Effet à cible : toucher l'effet, puis la carte visée (ex. Plains : défausser une autre carte amie). Cible dans la défausse : choix dans la défausse.

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
