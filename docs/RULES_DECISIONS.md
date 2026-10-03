# Décisions de règles

Une entrée par décision : date, question, décision, cartes concernées.

## 2026-10-02 : déclencheur de la dernière manche

- **Question** : la carte 68 dit « This is your last round » et fait découvrir 69 et 70 ; la spec plaçait le déclencheur sur la carte 70.
- **Décision** : c'est la découverte de la carte 68 qui lance la dernière manche. `isFinalRoundMarker` est posé sur 68 et retiré de 70.
- **Cartes** : 68, 70.

## 2026-10-02 : coûts d'amélioration en personnes

- **Question** : pour les coûts « N Persons » d'une amélioration, faut-il défausser ces personnes depuis la zone de jeu ?
- **Décision** : oui. On défausse N autres cartes en jeu portant le mot-clé Person, en plus du coût en ressources.
- **Par analogie (à confirmer)** : même traitement pour « N Lands », « N Buildings » et « N Seafaring » (carte 109 : « 2 Persons 2 Lands 2 Buildings » ; « 2 seafaring »).
- **Cartes** : 59, 66, 74, 75, 93, 109, 127, 128.

## 2026-10-02 : jouer une carte depuis la défausse

- **Question** : Town Hall, Keep et Castle se défaussent pour jouer une carte de la défausse. Castle (« any card ») peut-il se rejouer lui-même ?
- **Décision** : non, la carte qui active l'effet est exclue des choix. Se rejouer ne rapporterait rien et permettrait une boucle infinie. La carte jouée entre en jeu (les ressources en cours restent, voir ci-dessous).
- **Cartes** : 9.

## 2026-10-02 : ressources quand de nouvelles cartes entrent en jeu

- **Question** : la spec (4.5) disait les ressources perdues dès qu'une nouvelle carte entre en jeu (Avancer).
- **Décision** : non. Les ressources gagnées restent jusqu'à la fin du tour, même en avançant ou en jouant une carte depuis la défausse. Elles sont perdues à la fin du tour. Spec 4.5 et 10 corrigées.
- **Cartes** : toutes (règle générale).

## 2026-10-02 : effets de toutes les cartes (v0.19)

L'utilisateur veut tous les effets automatisés (pas de résolution à la main). Choix faits pour les cas que les cartes
ne tranchent pas ; à confirmer par l'utilisateur.

- **Ordre des effets simultanés** : dans l'ordre des cartes, d'abord les cartes déjà en jeu qui surveillent les arrivées
  (Volcanic Eruption, Assassin, Flooding), puis les « when played » des cartes arrivées. Pas de choix d'ordre.
- **Effet utilisé comme action** : le corps de l'effet s'applique la carte encore en jeu (« including this »), puis la
  carte paie le coût de son type (défausse, destruction) si l'effet ne l'a pas déjà déplacée.
- **Questions sans vrai choix** (une seule carte possible, une seule option) : résolues d'office.
- **Export / Mass Export** : à la fin de chaque tour, les marchandises restantes y sont dépensées automatiquement
  (elles seraient perdues), ce qui couvre la remarque de Jewellery (« the turn ends just slowly enough »).
- **« Mark 1-2 »** (Mercenary, Merchant) et **« Mark 1 »** : le joueur choisit les cases (corrigé le 2026-10-02 à la
  demande de l'utilisateur ; d'abord cochées de gauche à droite). Les pistes « from left to right » restent dans l'ordre.
- **Lord Aethan** (« passive: Mark 1 {mark} ») : utilisable à volonté, chaque case une fois, sans défausser la carte.
- **Camelot** (« End of Turn: If you have no cards in your deck, mark 1 ») : appliqué d'office, il n'a aucun coût.
- **Parchemin 24** : les deux stickers sont posés (Fertile Soil puis Efficiency), sur des cartes du royaume.
- **Young Princess** : « discard 2 persons » = 2 autres personnes en jeu ; sinon la carte est tournée.
- **Flooding** : bloque les bâtiments en jeu quand elle est jouée, puis ceux qui arrivent tant qu'elle est en jeu, 5 au plus.
- **Bandit, Skilled Bandit** : bloquent des cartes amies ; Enemy Soldier : 1 bâtiment ou 1 terre, amie ou non.
- **Pirate** : « effects give 1 less {coin} » s'applique à chaque gain par effet ; copier une production (Field Worker)
  donne la production déjà réduite, sans seconde réduction.
- **Trebuchet** : l'ennemi est vaincu avec son bonus (ressources, Lagoon), puis la case suivante d'Army est cochée sans payer.
- **Améliorer par effet** (Priest, Cardinal, Schools) : ne termine pas le tour ; interdit aussi par Dark Knight / Dark Prince.
- **Healing Potion** : proposée parmi les personnes à défausser ; choisie, elle est remise à zéro au lieu d'être défaussée.
- **Impregnable Fortress** : quand elle se défausse pour produire ou pour son effet, le jeu propose de défausser 2 murs à sa place.
- **Stickers de gloire** : comptent seulement quand leur stage est visible.
- **Double Wall** : 4 gloire par carte « Wall » du royaume entier.
- **Fin de manche** : les effets « End of Round » des cartes qui étaient en jeu (et des permanentes) ; « in your kingdom »
  = la défausse à ce moment-là.
- **Watchtower** : la deuxième carte de la pioche est montrée sous la pioche.
- **Wood Shipment** : bois et marchandises interchangeables pour payer.
- **Effet épuisé** (2026-10-03) : un effet dont toutes les cartes à découvrir ont quitté la boîte n'est plus utilisable
  (sauf découverte conditionnelle « When complete » ou avec une autre issue « or gain ») ; idem pour un effet « {mark} »
  dont toutes les cases sont cochées.
- **Export** (2026-10-03) : on y dépense toujours toutes ses marchandises.
- **Hors partie de base (phase P4)** : purge (Aethan Estate, bonus de Temple of Light) et mini-extensions 136 à 138.
- **Cartes** : 11 à 135.

## 2026-10-03 : face d'une carte découverte

- **Question** : la spec (section 4, « Cartes à flèches en haut ») faisait choisir la face visible de toute carte à flèches rouges au moment de sa découverte.
- **Décision** (demande du joueur) : une carte découverte arrive toujours côté recto, qu'elle vienne d'une manche ou d'un effet. On choisit la face seulement quand une instruction le dit : le parchemin 37 (« For each card, you need to choose one of its sides now ») pour les cartes 38 à 42. Une carte découverte par un effet est présentée (fenêtre « Nouvelle carte », bouton « Ajouter au deck ») ; une carte choisie dans une fenêtre de découverte ne l'est pas une seconde fois.
- **Anciennes parties** : au rejeu, un choix de face devenu sans objet est ignoré.
- **Cartes** : toutes celles à flèches rouges (13, 41, 42, 55, 69, 70, 92, 94, 95, 100, 101, 102, 107, 116, 121, 122, 126, 127), 37, 38 à 42.

## 2026-10-03 : purge et mini-extensions (v0.37)

Choix faits pour ce que les cartes et la spec ne précisent pas ; à confirmer.

- **Purge 12** : le royaume non permanent est rassemblé et mélangé, puis parcouru par paquets de 12 ; dans chaque paquet complet on choisit 1 carte amie à purger (ni ennemie ni indestructible, ni « cannot be purged » comme Ether Crystal). Les dernières cartes, moins de 12, ne sont pas purgées. Puis 1 carte permanente amie. Un paquet sans carte amie ne purge rien.
- **Aethan Estate** (« save N other cards from being purged ») : si elle est purgée, on choisit jusqu'à N autres cartes parmi celles choisies pour la purge ; elles restent dans le royaume.
- **Temple of Light** : à la purge, +10 {fame} par case cochée en plus de sa gloire.
- **Gloire purgée** : somme de la gloire des cartes purgées, ajoutée au score pour toujours ; les cartes vont dans une zone « purgées ».
- **Déroulement** : la carte d'extension rejoint les permanentes côté recto ; 4 manches sans découverte de début de manche ; à chaque fin de manche, après les effets « End of Round », elle passe à l'étape suivante (« Then {rotate} / {flip} ») ; à la 4e, elle est détruite et l'extension se termine. Le score de la partie de base, puis celui après chaque extension, forment le chemin de score.
- **Uprising** : chaque personne jouée alors qu'au moins une personne est déjà en jeu (y compris une jouée en même temps juste avant) coche 1 case.
- **Royal Decree** : pour chaque case cochée sur Uprising, 1 production rayée sur une carte du royaume au choix (la même carte peut être choisie plusieurs fois).
- **Obsolete Farms** : la carte détruite est choisie dans tout le royaume, parmi celles dont la production imprimée contient {coin}.
- **Espionage** : les 2 cartes amies défaussées sont prises en jeu.
- **Resistance** : comme Export, les épées restantes y sont dépensées automatiquement en fin de tour ; en fin de manche, le sticker 16 (gloire = total, 100 au plus) va sur une terre du royaume au choix.
- **Hoarding** : à chaque fin de tour, on peut garder 1 carte en jeu.
- **Garder des cartes en jeu** (Shrine, Temple, Villa…, demande du 2026-10-03) : les ennemis et les cartes qui restent déjà en jeu ne sont jamais proposés. Une carte gardée reste une carte ordinaire (pas une demi-carte de la ligne du haut).
