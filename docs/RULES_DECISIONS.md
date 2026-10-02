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
