# Fins de partie, mini-extensions et campagne

État au 5 octobre 2026 (v0.56). Ce guide décrit ce que fait l'application aujourd'hui, ce qui manque, et ce qui est faisable. Règles de référence : spec 4.4 (fin de partie), 4.7 (extensions), 6 (royaumes et sauvegardes) ; décision du 2026-10-02 sur la carte 68 dans `docs/RULES_DECISIONS.md`.

## 1. Vocabulaire

| Terme | Dans l'appli |
| --- | --- |
| **Royaume** | Une boîte de jeu virtuelle (140 cartes). C'est aussi la **campagne** : tout ce qui suit se passe dans le même royaume. |
| **Partie de base** | Cartes 1 à 70, de la première manche jusqu'à la fin de la manche lancée par la carte 68. |
| **Mini-extension** | Cartes 136 (Uprising…), 137 (The Water Mill…), 138 (Resistance…). Jouables après la partie de base, chacune une fois. |
| **Grande extension** | Nouvelles boîtes de cartes (jusqu'à 10 dans le jeu). **Pas dans l'appli** : leurs cartes ne sont pas encore récupérées. |
| **Chemin de score** | Le score de la partie de base, puis le score après chaque mini-extension (sticker 13k dans le jeu). |

## 2. Ce qui existe

### Fin de la partie de base

1. La découverte de la **carte 68** (parchemin « This is your last round », qui fait découvrir 69 et 70) annonce la dernière manche. Le journal note « C'est la dernière manche » et la barre du haut affiche « (dernière) ».
2. À la fin de cette manche, la partie est **terminée** (`phase = gameOver`). Score = gloire de toutes les cartes du royaume + gloire purgée.
3. La fenêtre **« Fin de la partie »** s'ouvre. Elle montre :
   - le score ;
   - le chemin de score ;
   - le détail de la gloire carte par carte ;
   - les trois mini-extensions, chacune avec un bouton « Jouer ».
4. « Voir le royaume » ferme la fenêtre pour regarder le plateau final. « Retour aux royaumes » revient à l'accueil, où le royaume est marqué **Terminé**.

### Mini-extension

1. « Jouer The Water Mill » (par exemple) lance d'abord la **purge** : 1 carte par paquet de 12 du deck mélangé, puis 1 carte permanente. Aethan Estate peut sauver des cartes. La gloire des cartes purgées est gardée pour tous les scores suivants.
2. Ensuite viennent **4 manches sans découverte**. La carte d'extension change d'étape à chaque fin de manche, avec son action de fin (Royal Decree, Obsolete Farms, Resistance…).
3. Après la 4e manche, la carte est détruite et son score s'ajoute au chemin de score. La fenêtre **« Fin de la mini-extension »** s'ouvre et l'extension jouée y est grisée « Déjà jouée ».

### Fin de campagne

- La campagne est finie quand les **trois mini-extensions** ont été jouées : il ne reste plus rien à lancer. Le royaume reste consultable, mais aucun écran ne dit « campagne terminée ».
- Le joueur peut aussi s'arrêter après n'importe quelle étape : rien ne l'oblige à jouer les mini-extensions.

### Scores visibles aujourd'hui

| Où | Ce qu'on voit |
| --- | --- |
| Barre du haut | Gloire actuelle, chronomètre total du royaume. |
| Stats → Gloire | Les cartes qui rapportent ou font perdre de la gloire. |
| Fenêtre de fin | Score, chemin de score (base + chaque mini-extension), détail par carte. |
| Accueil | Manche, gloire actuelle, dernière carte découverte, durée, statut En cours / Terminé. |

### Sauvegardes et retours en arrière

| Outil | Ce qu'il fait |
| --- | --- |
| Sauvegarde automatique | Après chaque action. On reprend exactement où on s'est arrêté. |
| **Annuler** | Mode Libre : sans limite, y compris à travers une fin de partie ou une mini-extension entière. Mode Strict : seulement dans le tour en cours, tant que rien n'a été révélé. |
| **Dupliquer** (accueil) | Copie complète du royaume à l'instant T, nommée « (copie) ». |
| **Exporter / Importer** | Fichier JSON du royaume. L'import rejoue toute la partie. |
| **Recommencer** | Seulement avant la découverte de la carte 23 (règle officielle). |

## 3. Ce qui manque

1. **Rouvrir l'écran de fin.** Une fois fermé avec « Voir le royaume », il ne revient qu'en rechargeant la page. Le chemin de score n'est donc plus visible.
2. **Tableau des scores de la campagne.** Aucun bouton ne montre, à tout moment, la partie de base et chaque mini-extension avec leur score, leur date et leur durée.
3. **Statut sur l'accueil.** On ne voit ni « Mini-extension en cours (The Water Mill, manche 2/4) » ni « Campagne terminée ». Pendant une mini-extension, le royaume est simplement « En cours ».
4. **Date et durée de chaque étape.** Le chronomètre compte le royaume entier, sans découpage par partie ou par mini-extension.
5. **Points de sauvegarde nommés** (prévus par la spec 6.1). Ils ne sont pas faits ; voir la section 4 avant de les ajouter.
6. **Grandes extensions.** Hors périmètre tant que leurs cartes ne sont pas récupérées.

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
