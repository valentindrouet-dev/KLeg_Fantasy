# Journal des versions

Chaque mise à jour publiée change de version (`package.json`, affichée dans l'appli en bas de l'écran « Mes royaumes »
et dans la barre de la partie). Convention : `0.5.0` s'affiche **v0.05** ; un correctif `0.5.1` s'affiche **v0.05.1**.

## v0.21 (2 octobre 2026)

- Effets et améliorations dans les deux sens : toucher l'effet (ou l'amélioration) sans assez de ressources fait briller les cartes qui peuvent payer ; on les touche, l'action part dès que le coût est couvert. Toucher ailleurs ou Échap annule.
- Deux compteurs de ressources en haut : en vert, ce qui est engrangé (ressources gagnées et cartes engagées) ; en gris, ce que les autres cartes en jeu peuvent encore produire.
- Nouvelles cartes de début de manche : appui long sur une carte pour voir son recto verso.

## v0.20 (2 octobre 2026)

- Début de manche : les cartes découvertes s'affichent dans une fenêtre ; « Mélanger dans le deck » les ajoute au deck.
- Mélange animé : les cartes de la défausse volent vers la pioche, la pioche est battue, puis les 4 cartes du tour arrivent.
- Carte bloquée : posée sous la carte qui la bloque, le haut (nom et bandeau) dépasse.
- Ennemis sur une ligne à eux, en haut de la zone de jeu, quand la place le permet (sinon en tête de rangée).
- Inspection : l'autre face dans le même sens (1 à côté de 4, 2 à côté de 3 à l'envers).

## v0.19 (2 octobre 2026)

Phase P3 : les effets de toutes les cartes de la partie de base (1 à 135) sont automatisés.

- Effets d'action, de temps et de destruction de chaque carte, effets passifs et effets déclenchés (quand la carte est jouée, fin de tour, fin de manche, après une amélioration, après une production, entre deux manches).
- Quand un effet demande un choix, une fenêtre le pose : cartes à choisir, ressources « au choix », option. « Annuler » tant que rien n'est payé.
- Ennemis : blocage des cartes, défaite en dépensant des épées, interdictions (Dark Knight, Rain…).
- Pistes à cocher (Army, Treasury, Export, Quests…), stickers posés par les effets, parchemin 24, gloire variable (objectifs, pistes, Double Wall…).
- Cartes permanentes : toucher Army, Treasury… propose leur effet.
- Pastilles sur les cartes : cartes bloquées, cases cochées, marchandises dépensées, stickers.
- Watchtower : la 2e carte de la pioche est visible.
- Décisions de règles prises pour les cas ambigus : `docs/RULES_DECISIONS.md`.

## v0.18 (2 octobre 2026)

- Retour sur la v0.17 : la résolution à la main est retirée (bouton ✋, outils de l'inspection). Toucher un effet pas encore automatisé ne fait plus rien, comme en v0.16, au lieu de défausser la carte.
- Les parties jouées en v0.17 restent lisibles et annulables.

## v0.17 (2 octobre 2026)

Début de la phase P3 : résolution à la main, pour que la partie ne soit jamais bloquée par un effet pas encore automatisé.

- Effet non automatisé : toucher l'effet l'utilise (la carte est défaussée, détruite ou finit le tour selon son type) ; on applique le reste à la main.
- Bouton ✋ dans la barre du haut : ajouter ou retirer des ressources, découvrir une carte par son numéro, retrouver n'importe quelle carte.
- Inspection (appui long) : changer l'orientation, déplacer la carte (en jeu, défausse, dessus ou dessous de la pioche, permanentes, détruite, boîte), cocher les cases, poser un sticker de ressource ou de gloire.
- Toutes ces opérations s'annulent comme les autres actions et sont gardées dans la sauvegarde.
- Les stickers posés s'affichent en pastille sur la carte.

## v0.16 (2 octobre 2026)

- Pioche et défausse en bas de l'écran en paysage aussi (même disposition qu'en portrait).
- « Signaler un bug ou une idée » (⚙ dans la partie, et en bas de l'accueil) : ouvre un ticket GitHub pré-rempli.

## v0.15 (2 octobre 2026)

- Règle : les ressources gagnées restent quand on avance (ou qu'une carte est jouée depuis la défausse) ; elles ne se perdent qu'à la fin du tour.
- Cartes à image pleine (une étape par face) : étapes 1 et 2 au lieu de 1 et 4 (pastilles et Stats).
- « Manche X » fixé juste sous la barre du haut, sur iPad comme ailleurs.

## v0.14 (2 octobre 2026)

- Réglages (⚙) : thème Auto (selon l'appareil), Clair ou Sombre.
- « Manche X » un peu plus bas.
- Pioche et défausse de la même taille en paysage qu'en portrait.

## v0.13 (2 octobre 2026)

- Le zoom (⚙) ne change plus que la taille des cartes en jeu (60 à 200 %) ; interface, boutons, pioche et défausse restent à 100 %.
- Bouton « Sauvegarder le royaume » dans la partie : télécharge un fichier de sauvegarde.
- Bouton « Importer une sauvegarde » sur l'accueil : la partie est rejouée depuis le fichier (fichier abîmé refusé).
- Toucher à deux doigts : contour bleu épais au lieu du drapeau.
- Plus aucun message en bas après une action ou quand une action est impossible.

## v0.12 (2 octobre 2026)

- Plus de message « Annuler » après une amélioration.
- « Manche X » s'affiche en haut, au-dessus de la zone des cartes.
- Stats : nombre de cartes à l'étape 1, 2, 3 et 4 ; cases colorées selon ce qu'elles comptent ; types en anglais (Land, Building…).
- Toucher une carte hors des zones d'action : bulle avec la traduction de la moitié touchée (seulement si FR est activé).
- Une carte grisée perd son grisage juste avant sa rotation d'amélioration.

## v0.11 (2 octobre 2026)

- Le zoom agrandit aussi les cartes en jeu (au-delà de 100 %, la zone de jeu défile si besoin).
- Icône de l'appli iPad : la pièce sur fond noir (à réinstaller sur l'écran d'accueil pour la voir).
- Toucher une carte en jeu avec deux doigts (Alt + clic sur ordinateur) : petit drapeau au-dessus, qui disparaît quand la carte quitte le jeu.
- Grisage du bas : seulement sur les cartes qui ont deux étapes sur la face visible.
- Plus de fenêtre quand on touche une carte en dehors d'une zone d'action ; pas d'infobulle après un clic.

## v0.10 (2 octobre 2026)

- Correctif : une carte tournée (Plains, Felled Forest…) partait vers le haut à gauche au lieu d'aller à la défausse (fin de tour, effet).
- « Manche X » centré à l'écran.
- Inspection : la face visible telle qu'elle est posée, et l'autre face retournée de haut en bas (1 en haut ↔ 3 en haut).
- Cartes en jeu triées par ressource (par défaut), par type de terrain ou dans l'ordre d'arrivée : bouton ⇅.
- Bouton Stats : cartes par zone, production par ressource, gloire, types de cartes, découvertes, détruites, boîte.

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
