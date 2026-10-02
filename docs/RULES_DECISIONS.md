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
- **« Mark 1-2 »** (Mercenary, Merchant) et **« Mark 1 »** : cases cochées de gauche à droite.
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
- **Hors partie de base (phase P4)** : purge (Aethan Estate, bonus de Temple of Light) et mini-extensions 136 à 138.
- **Cartes** : 11 à 135.
