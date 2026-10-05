# Fins de partie, mini-extensions et campagne

État au 5 octobre 2026 (v0.63). Ce guide décrit ce que fait l'application aujourd'hui, ce qui manque, et ce qui est faisable. Règles de référence : spec 4.4 (fin de partie), 4.7 (extensions), 6 (royaumes et sauvegardes) ; décision du 2026-10-02 sur la carte 68 dans `docs/RULES_DECISIONS.md`.

## 1. Vocabulaire

| Terme | Dans l'appli |
| --- | --- |
| **Royaume** | Une boîte de jeu virtuelle (140 cartes). C'est aussi la **campagne** : tout ce qui suit se passe dans le même royaume. |
| **Partie de base** | Cartes 1 à 70, de la première manche jusqu'à la fin de la manche lancée par la carte 68. |
| **Mini-extension** | Cartes 136 (Uprising…), 137 (The Water Mill…), 138 (Resistance…). Jouables après la partie de base, chacune une fois. |
| **Grande extension** | Nouvelle boîte de cartes ajoutée au royaume. **Merchants** (cartes 00 à 25) est jouable depuis la v0.63 ; les autres attendent leurs cartes. |
| **Chemin de score** | Le score de la partie de base, puis le score après chaque mini-extension (sticker 13k dans le jeu). |

## 2. Ce qui existe

### Fin de la partie de base

1. La découverte de la **carte 68** (parchemin « This is your last round », qui fait découvrir 69 et 70) annonce la dernière manche. Le journal note « C'est la dernière manche » et la barre du haut affiche « (dernière) ».
2. À la fin de cette manche, la partie est **terminée** (`phase = gameOver`). Score = gloire de toutes les cartes du royaume + gloire purgée.
3. La fenêtre **« Fin de la partie »** s'ouvre (refaite en v0.65). Elle montre :
   - le score ;
   - le **parcours du royaume** : partie de base, puis chaque extension dans l'ordre joué, avec son score, reliées par des flèches ;
   - les **extensions** en tuiles : faites, cochées en vert avec leur score ; à jouer, avec un bouton « Jouer ». Merchants est montrée par le dos de ses cartes.
   Le détail de la gloire carte par carte est dans Stats → Gloire.
4. « Voir le royaume » ferme la fenêtre pour regarder le plateau final. « Retour aux royaumes » revient à l'accueil, où le royaume est marqué **Terminé**.

### Mini-extension

1. « Jouer The Water Mill » (par exemple) lance d'abord la **purge** : 1 carte par paquet de 12 du deck mélangé, puis 1 carte permanente. Aethan Estate peut sauver des cartes. La gloire des cartes purgées est gardée pour tous les scores suivants.
2. Ensuite viennent **4 manches sans découverte**. La carte d'extension change d'étape à chaque fin de manche, avec son action de fin (Royal Decree, Obsolete Farms, Resistance…). Au début de chaque manche, l'étape jouée de la carte est montrée en grand (v0.64), avec sa traduction ; on la touche pour la fermer.
3. Après la 4e manche, la carte est détruite et son score s'ajoute au chemin de score. La fenêtre **« Fin de la mini-extension »** s'ouvre et l'extension jouée y est grisée « Déjà jouée ».

### Grande extension : Merchants (v0.63)

1. « Jouer Merchants » (fenêtre de fin, à côté des mini-extensions) ajoute ses 26 cartes à la boîte du royaume, sans rien retirer, puis rassemble et mélange le deck.
2. Le parchemin 00 (« Welcome ») se lit, puis la **purge 7** : 1 carte par paquet complet de 7, puis **2 cartes permanentes**.
3. Merchants 01 est découverte (permanente). Pas de découverte automatique pendant 4 manches : on découvre les cartes proposées par Merchants 01, puis 10 (effet {time} : on touche la carte, puis le choix dans le menu).
4. Les fins de manche de Merchants 01 et 10 mènent l'extension : Brigands (19), puis Merchants 10, puis la fin. Le score rejoint le chemin de score (sticker 13e) ; la fenêtre « Fin de l'extension Merchants » s'ouvre.
5. Les cartes de Merchants restées dans la boîte et citées par une carte découverte y restent (découvrables par leur effet seulement) ; les autres sont détruites. Merchants ne se joue qu'une fois par royaume.

Décisions de règles : `docs/RULES_DECISIONS.md` (2026-10-05, extension Merchants).

### Un royaume n'est jamais clôturé (v0.57)

- Il n'y a pas de « campagne terminée » : un royaume attend toujours la prochaine extension, même quand toutes celles connues sont jouées, puisque d'autres pourront être ajoutées.
- Statuts sur l'accueil (`campaignStage`) :

| Statut | Quand | Bouton |
| --- | --- | --- |
| En cours | Partie de base en cours | Continuer |
| *Nom* · manche n/4 | Mini-extension en cours | Continuer |
| Extension à lancer | Une extension disponible n'a pas été jouée | Extensions |
| En attente de nouvelles extensions | Toutes les extensions disponibles sont jouées | Consulter |

- Le joueur peut s'arrêter après n'importe quelle étape : rien ne l'oblige à jouer les extensions.

### Scores visibles aujourd'hui

| Où | Ce qu'on voit |
| --- | --- |
| Barre du haut | Gloire actuelle, chronomètre total du royaume. |
| Stats → Gloire | Les cartes qui rapportent ou font perdre de la gloire. |
| Fenêtre de fin | Score, parcours du royaume (base puis chaque extension, dans l'ordre joué), extensions faites et à jouer. |
| Accueil | Manche, gloire actuelle, dernière carte découverte, durée, statut de la campagne. |
| Accueil → coupe (à côté de Continuer) | **Tableau des scores** : partie de base et chaque extension (état, score, date de fin, temps de jeu), gloire actuelle, gloire purgée, temps total ; grandes extensions « À venir » dès qu'elles sont déclarées. |

### Sauvegardes et retours en arrière

| Outil | Ce qu'il fait |
| --- | --- |
| Sauvegarde automatique | Après chaque action. On reprend exactement où on s'est arrêté. |
| **Annuler** | Mode Libre : sans limite, y compris à travers une fin de partie ou une mini-extension entière. Mode Strict : seulement dans le tour en cours, tant que rien n'a été révélé. |
| **Dupliquer** (accueil) | Copie complète du royaume à l'instant T, nommée « (copie) ». |
| **Exporter / Importer** | Fichier JSON du royaume. L'import rejoue toute la partie. |
| **Recommencer** | Seulement avant la découverte de la carte 23 (règle officielle). |

## 3. Ce qui manque

1. **Rouvrir l'écran de fin.** Une fois fermé avec « Voir le royaume », il ne revient qu'en rechargeant la page. Le tableau des scores de l'accueil montre maintenant le chemin de score.
2. ~~Tableau des scores de la campagne~~ : fait en v0.57.
3. ~~Statut sur l'accueil~~ : fait en v0.57.
4. ~~Date et durée de chaque étape~~ : fait en v0.57 (`Kingdom.milestones`). Les étapes finies avant n'ont ni date ni durée : elles ne sont pas inventées.
5. **Points de sauvegarde nommés** (prévus par la spec 6.1). Ils ne sont pas faits ; voir la section 4 avant de les ajouter.
6. **Grandes extensions.** Merchants est jouable (v0.63). Les autres (Ridding the Woods, Feudal Kingdom Adventures…) attendent leurs cartes.

## 4. Embranchements : recommencer une extension ?

Kingdom Legacy est un jeu *legacy* : ce qui est fait est fait. Dans la boîte physique, on ne rejoue pas une mini-extension, et une carte détruite l'est pour toujours. L'appli permet déjà deux formes d'embranchement :

- **Dupliquer** crée un second royaume, qui suit ensuite sa propre histoire. C'est explicite et ça ne touche pas l'original : c'est la bonne façon de « tenter autre chose ».
- **Annuler en mode Libre** peut remonter jusqu'avant le lancement d'une mini-extension, puis en lancer une autre. Le royaume réécrit alors son histoire sans que rien ne le signale.

**Recommandation :** ne pas ajouter de « recommencer une extension » ni de points de sauvegarde à restaurer dans un même royaume. Garder Dupliquer comme seul moyen de bifurquer. À la place :

- **Jalons en lecture seule.** À chaque fin (partie de base, chaque mini-extension), garder une copie figée de l'état, pour revoir le royaume tel qu'il était à ce moment-là, sans pouvoir la reprendre. Ça ne crée aucune branche.
- **Garde-fou sur Annuler.** En mode Libre, demander une confirmation avant d'annuler au-delà d'un jalon (« Tu vas défaire la fin de la partie de base »). Une option pourrait l'interdire tout court.

## 5. Ce qui est faisable, par ordre d'intérêt

| # | Ajout | Effort | Remarques |
| --- | --- | --- | --- |
| A | **Bouton « Campagne »** dans la barre du haut : tableau des scores (partie de base, chaque mini-extension : score, gloire purgée, date de fin, durée), extensions restantes, état de la campagne. Rouvre aussi l'écran de fin. | Moyen | Les scores sont déjà enregistrés (`state.campaign`). Il faut ajouter la date et la durée de chaque étape. Les royaumes existants verraient leurs anciennes étapes sans date. |
| B | **Statuts sur l'accueil** : « Mini-extension en cours (nom, manche n/4) », « Campagne terminée (3/3) ». | Faible | Calculé depuis l'état, sans nouvelle donnée. |
| C | **Jalons en lecture seule** consultables depuis le bouton Campagne. | Moyen | Une copie d'état par fin, gardée avec le royaume. |
| D | **Confirmation avant d'annuler au-delà d'un jalon** (mode Libre). | Faible | Évite de défaire une fin sans le vouloir. |
| E | Points de sauvegarde nommés restaurables. | Moyen | Déconseillé (embranchements) : Dupliquer fait déjà ce travail. |
| F | Grandes extensions. | Grand | Il faut d'abord leurs cartes et leurs règles. |

## 6. Préparé pour les grandes extensions (v0.57)

- **`campaignSteps(catalog, state)`** (moteur) liste les étapes : la partie de base, puis chaque extension, avec leur état (terminée, en cours, à jouer, à venir) et leur score. Aujourd'hui les extensions sont les mini-extensions 136 à 138. Une grande extension s'y ajoutera comme une étape de plus.
- **`campaignStage(state)`** donne le statut du royaume (base, extension, between, waiting), jamais « terminé ».
- **Tableau des scores** : les extensions déclarées dans `data/expansions.json` avec `kind: "grand"` ou `"custom"` apparaissent « À venir » sans rien d'autre à coder.
- **Jalons** (`Kingdom.milestones`) : identifiés par l'étape (« base », numéro de la carte d'extension). Une grande extension aura son propre identifiant.
- **Pour jouer une grande extension** (fait pour Merchants en v0.63) :
  - récupérer ses cartes (fiches dans `data/cards/<Extension>/`, images, traduction) ;
  - déclarer ses règles dans `GRAND_EXPANSIONS` (`src/engine/campaign.ts`) : purge, carte guide, nombre de manches, sticker du chemin de score ;
  - écrire les effets de ses cartes (`src/engine/effects/merchants.ts` pour Merchants) ;
  - mesurer ses images : `npm run checkbox-spots -- --expansion <Extension>`, idem `text-lines`, `upgrade-spots`, `fame-spots`, `production-spots`, puis les déclarer dans `src/data/*.ts`.
  Ses cartes s'ajoutent à la boîte au lancement (action `startGrandExpansion`) ; les cartes citées par numéro sont cherchées dans l'extension de la carte qui les cite.
- **Aucune donnée supprimée.** Les nouveaux champs (`summary.stage`, `milestones`) sont facultatifs. Les royaumes existants s'affichent avec leur nouveau statut calculé depuis leur état, sans migration.
