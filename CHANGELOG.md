# Journal des versions

Chaque mise à jour publiée change de version (`package.json`, affichée dans l'appli en bas de l'écran « Mes royaumes »
et dans la barre de la partie). Convention : `0.5.0` s'affiche **v0.05** ; un correctif `0.5.1` s'affiche **v0.05.1**.

## v0.62 (5 octobre 2026)

- Extension **Merchants** importée (fiches extraites sur le Mac) : 26 cartes (0 à 25) et leurs 52 images, toutes valides avec le schéma ; 16 ont des points à vérifier. Traduction française de toutes les cartes (infobulles FR). Elle est visible dans la visionneuse de données et « À venir » dans le tableau des scores. Elle n'est pas encore jouable : ses règles (purge 7 + 2 permanentes, 4 manches sans découverte automatique) et les effets de ses cartes restent à écrire.
- Les parties en cours ne sont pas touchées : une partie ne prend que les cartes de son extension.

## v0.61.1 (5 octobre 2026)

- Message d'une amélioration impayable plus clair : quand une carte engagée doit aussi être défaussée pour le coût en cartes (« 2 Persons »), le message dit ce qui manque et pourquoi. Par exemple, pour Guild : « Il manque [pierre] : Miners est défaussée pour le coût en cartes, elle ne peut pas aussi produire ». Avant : « Pas payable avec les cartes engagées ».

## v0.61 (5 octobre 2026)

- Miners (#73, « May be counted as 2 persons ») compte pour 2 personnes quand ça t'avantage :
  - coûts en personnes des améliorations (Spoiled Princess : toucher Miners suffit) ;
  - effets « Discard 2 / 3 persons » ;
  - gains par personne en jeu, Cathedral, Strength in Numbers.

  Jamais avec une personne de trop (Miners + une autre pour « 2 Persons » n'est pas proposé). Il compte pour 1 dans ce qui te pénalise (Uprising).

## v0.60 (5 octobre 2026)

- Stranger (#92) : « Give her a name! » ne faisait rien. Dans l'inspection de la carte (appui long), un champ « Son nom » permet de la nommer ou de la renommer, sans fenêtre. Le nom s'écrit sur le blanc « ________ » du bandeau et remplace le titre partout (journal, questions, listes). C'est une action enregistrée : annulable, sauvegardée.
- Cartes à effets « 1st / 2nd / 3rd play » : une pastille compte les passages en jeu (« 2e passage »), et « ✎ à nommer » rappelle le nom à donner.

## v0.59 (5 octobre 2026)

- Stickers de gloire (8, 10, 16) : posés sur la ligne de la rosette de gloire imprimée, juste après elle et à sa taille (sur Food Barns : à droite du « 3 »), et plus dans la rangée des ressources. Sans gloire imprimée, ils prennent sa place. Sur les cartes à gloire variable, ils suivent la rosette « * » mesurée.

## v0.58 (5 octobre 2026)

- Fenêtre des nouvelles cartes : elle tient entière dans l'écran, sans défilement ni carte coupée à droite (iPad en portrait comme en paysage, avec ou sans la barre du mode dev). La taille des cartes tient compte des libellés « Gardée » et de la légende des stickers, et se recalcule quand on tourne l'iPad.
- Stickers cités sur l'image d'une carte (« Add sticker 6 and 10 ») : une légende sous la carte donne le symbole et le sens de chacun (« Sticker 6 [symbole] marchandise · Sticker 10 [symbole] gloire 5 »), dans la fenêtre des nouvelles cartes et dans l'inspection (appui long).

## v0.57 (5 octobre 2026)

- Accueil : un bouton coupe à côté de « Continuer » ouvre le **tableau des scores** de la campagne du royaume. On y trouve la partie de base et chaque extension, avec leur état (terminée, en cours avec la manche, à jouer, à venir), leur score, la date de fin et le temps de jeu ; en dessous, la gloire actuelle, la gloire purgée et le temps total. Les étapes finies avant cette version n'ont pas de date : elle n'était pas enregistrée.
- Un royaume n'est jamais « terminé » : « En cours », « *Mini-extension* · manche n/4 », « Extension à lancer » (bouton « Extensions ») ou « En attente de nouvelles extensions ».
- Préparation des grandes extensions : étapes de campagne génériques ; une extension déclarée dans les données apparaît « À venir » dans le tableau. Guide : `docs/FINS_DE_PARTIE.md`.
- Aucune donnée existante n'est supprimée : nouveaux champs facultatifs, statuts calculés depuis l'état des royaumes.

## v0.56 (5 octobre 2026)

- Gloire variable : sur les cartes dont la gloire dépend du royaume (« * » : Strength in Numbers, Loyalty, The Ark, Camelot…), la gloire qu'elles valent maintenant est écrite sur leur rosette, sur la face posée comme en jeu. Positions mesurées sur les images (`npm run fame-spots`).
- Mode développeur (bouton clé à molette dans la barre du haut, rouge quand il est actif ; éteint à chaque ouverture). Pour se dépanner hors des règles :
  - barre dev : + / − sur chaque ressource, pioche et boîte consultables, « Passer la question » quand une question est bloquée ;
  - toucher une carte (plateau, permanentes, pioche, défausse, boîte) ouvre son inspection avec les gestes dev : la mettre en jeu, en défausse, dessus ou dessous de la pioche, en permanente, la détruire, la rendre à la boîte ou la découvrir ; choisir son étape ; cocher / décocher ses cases ; poser un sticker ; rendre ses effets rayés utilisables.
  - Chaque geste est une action enregistrée : annulable, sauvegardée, rejouée à l'import ; le journal les note « Mode dev ».

## v0.55 (5 octobre 2026)

- Stickers toujours visibles : une carte de la partie montre ses stickers partout où elle est dessinée (questions des effets, défausse, listes, inspection…).
- Inspection (appui long) : en haut, un bouton par carte citée dans le texte de la carte (« Discover Shrine (82 / 83) », « cards 31-34 », « Discover Dubbing (86) »…), avec son numéro et son nom. Le toucher ouvre l'inspection de cette carte, même encore dans la boîte ; « ← Retour » revient à la carte précédente.

## v0.54 (5 octobre 2026)

- Questions d'Export : elles rappellent la case utilisée et son effet (« Export 20 {tradeGood} · Sticker 7 [symbole] (Stays in play) : sur quelle personne ? »).
- Une question déjà posée dans une partie enregistrée est reformulée au chargement avec le texte de la nouvelle version (avant, l'ancien libellé restait jusqu'à la question suivante).
- Fenêtre d'une question : un appui long sur la carte qui pose la question (Export…) ouvre son inspection, au-dessus de la question.

## v0.53.5 (5 octobre 2026)

- Stickers cités par leur numéro : partout où un texte dit « sticker 7 », « sticker 1 / 2 / 3 », « sticker 13k »… (questions, boutons, textes de cartes), le symbole du sticker suit son numéro. La question d'Export dit maintenant quel sticker poser et sur quel type de carte (« Sticker 7 [symbole] (Stays in play) : sur quelle personne ? »).

## v0.53.4 (5 octobre 2026)

- Correctif : avec un ennemi en jeu, une demi-carte « stays in play » seule dans sa colonne prenait la hauteur d'une carte entière mais n'était comptée que pour une demi-carte dans le calcul de la taille des cartes. La zone de jeu débordait : les cartes du haut et du bas étaient coupées. Le calcul compte maintenant la vraie hauteur.

## v0.53.3 (4 octobre 2026)

- Correctif : une carte pouvait rester bloquée avec le contour bleu (drapeau des deux doigts), sans qu'on puisse l'utiliser ni retirer le contour. Le jeu croyait qu'un doigt était encore posé dessus (lever perdu) : chaque toucher passait pour un toucher à deux doigts. Un nouveau toucher repart maintenant de zéro.

## v0.53.2 (4 octobre 2026)

- Demi-cartes « stays in play » : en colonnes de deux seulement s'il y a un ennemi en jeu, ou si elles sont trop nombreuses pour tenir sur une ligne sans rapetisser les cartes. Sinon elles restent sur une ligne, comme avant.

## v0.53.1 (4 octobre 2026)

- Zone de jeu : les demi-cartes « stays in play » se rangent par colonnes de deux, l'une sur l'autre, à la hauteur d'une carte entière. À côté d'un ennemi, elles tiennent sur la même ligne au lieu de passer à la ligne ; une demi-carte seule est centrée sur cette hauteur. Les autres cartes restent dessous.

## v0.53 (4 octobre 2026)

- Carte « rayée » : glisser le doigt horizontalement sur une carte (comme pour la rayer) l'entoure d'un halo rouge, pour dire qu'on n'en a plus l'usage et qu'on peut la détruire ou la purger si besoin. Un second glissé retire le halo. Ça marche partout où la carte est dessinée : en jeu, défausse, inspection, questions des effets (purge comprise), stats. Le halo est gardé avec le royaume et tombe quand la carte est détruite ou purgée.

## v0.52.2 (4 octobre 2026)

- Défausse (et cartes détruites) : les objectifs sont visibles, comme en jeu. L'étape visée est entourée en doré et la boîte d'amélioration qui y mène est dorée. Les stickers des cartes y sont aussi dessinés.

## v0.52.1 (4 octobre 2026)

- Filtres de la défausse et stats : Invention en rose comme sur la carte ; Knight (et Lady, Elder) en jaune comme les personnes ; Ship en bleu comme Seafaring ; Horse en orange comme Livestock.

## v0.52 (4 octobre 2026)

- Défausse (et cartes détruites) : boutons colorés par type dans l'en-tête, à côté de « Voir le jeu » (Land, Building, Person, Enemy…, avec leur nombre). En toucher un ne montre que ce type ; le retoucher montre tout. Le filtre disparaît à la fermeture.

## v0.51 (4 octobre 2026)

- Stats : toucher la case Gloire montre toutes les cartes du royaume qui rapportent ou font perdre de la gloire, leur valeur posée dessus (+3, −2 en rouge), des plus rentables aux négatives. La gloire des cartes purgées est indiquée au-dessus. Toucher une carte l'inspecte.

## v0.50.1 (4 octobre 2026)

- Missionary : la conversion retournait bien le Bandit (il devient Field Worker), mais sans animation, et il partait dans la défausse sous le Missionary : on ne le voyait pas. Une carte retournée ou tournée par l'effet d'une autre carte (Missionary → Bandit…) s'anime maintenant sur le plateau avant d'être défaussée.

## v0.50 (4 octobre 2026)

- Cartes permanentes : le compteur (Army, Treasury, Export…) est de nouveau posé sur la carte, en haut sur le texte d'ambiance, et plus en dessous.
- Chronomètre de partie : ⏱ dans la barre du haut, et sur l'écran « Mes royaumes ». Il ne compte que quand l'appli est à l'écran, s'arrête à la fin de la partie, est gardé avec le royaume et dans la sauvegarde exportée.
- Stickers de ressource : même taille que les icônes imprimées (50 px sur 373), dans leur rangée et au même pas (repères remesurés sur Farmlands, Festival, Tavern). Ils ne chevauchent plus la dernière icône.

## v0.49.2 (4 octobre 2026)

- Parchemin 24 : les deux questions disent leur étape et le type de carte attendu. « 1/2 · Fertile Soil » propose les terres (sticker 1 {coin}), puis « 2/2 · Efficiency » les bâtiments, Food Barns comprise. Test ajouté.

## v0.49.1 (4 octobre 2026)

- Correctif : avec un échange engagé (Bazaar) et pas d'or en réserve, le paiement disait « Pas payable avec les cartes engagées ». Maintenant il dit ce qui manque ({coin}) et fait briller les cartes qui peuvent le produire (Headquarters…) : on les touche et l'amélioration se fait.

## v0.49 (4 octobre 2026)

- Effets « stay in play » (Shrine, Sanctuary, Hoarding…) : plus de fenêtre Oui/Non. En fin de tour, les cartes qu'on peut garder sont entourées sur le plateau ; on touche celles à garder. Pour « up to N », « Valider » en bas. Un bouton en bas, « Je ne veux rien garder », refuse l'effet. Hoarding ne propose plus les ennemis ni les cartes qui restent déjà en jeu.

## v0.48 (4 octobre 2026)

- Objectifs : dans l'inspection d'une carte (appui long) ou dans la fenêtre des nouvelles cartes, maintenir appuyée une moitié de carte la marque comme objectif. Elle est entourée en doré partout où la carte est dessinée, et la boîte d'amélioration qui y mène (premier pas du chemin) est dorée aussi. L'objectif tombe quand la carte atteint cette étape (ou quitte le royaume) ; un nouvel appui long le retire. Gardé avec le royaume.

## v0.47 (4 octobre 2026)

- Bazaar, Market, Trader (« Spend {coin} to gain {wood}/{stone}… ») : toucher l'effet engage la carte comme une production, sans menu. En haut, la ressource au choix s'ajoute et l'or qu'elle coûte est retiré ; au moment de payer, l'or vient de la réserve ou d'une autre carte engagée, puis l'échange donne la ressource qu'il faut.

## v0.46 (4 octobre 2026)

- Payer une amélioration ou un effet en touchant des cartes : chaque carte choisie porte la coche verte (et la carte visée, pour le Priest), sans être grisée ; la toucher à nouveau la retire.

## v0.45.1 (4 octobre 2026)

- Les ressources d'un effet de gain (Servant, « Gain any N resources ») n'apparaissent en haut qu'une fois l'effet touché ; avant, elles s'y affichaient déjà en gris.

## v0.45 (4 octobre 2026)

- Servant (« Gain {coin} / {wood} / {stone} ») et les cartes « Gain any N resources » (Investor, Feast, Educated Princess, City on a Hill, Raid…) : toucher l'effet engage la carte comme une carte de production, sans fenêtre. La ressource au choix s'ajoute en haut avec les autres ; elle est prise au moment de payer, dans la ressource qu'il faut.

## v0.44 (4 octobre 2026)

- Cartes à flèches rouges (Field Worker / Servant…) : dans la fenêtre « Nouvelles cartes », on touche la face à garder (recto par défaut), appliquée en validant. Vaut pour les découvertes de manche comme pour celles d'un effet.
- Les fenêtres commencent sous la barre du haut : les boutons FR et bug ne masquent plus « Voir le jeu ».

## v0.43 (4 octobre 2026)

- Fenêtres à nouveau opaques, sur un fond assombri. Bouton « Voir le jeu » en haut de chaque fenêtre : elle se cache sans se fermer (le choix reste en attente) pour regarder la zone de jeu ; « Revoir … » en bas de l'écran la rouvre.

## v0.42 (4 octobre 2026)

- Sticker « Stays in play » (sticker 7) : un bandeau lisible « ∞ Stays in play. » au-dessus du texte des effets, comme sur les cartes imprimées, au lieu d'une petite pastille dans la rangée des ressources.

## v0.41 (4 octobre 2026)

- Engineer (33) et la carte 49 (« Destroy one of the following cards… ») : chaque option se barre ligne par ligne dès que sa carte a été découverte, et n'est plus proposée (la carte en jeu correspondante ne peut plus être détruite pour rien). Toutes les options faites : tout l'effet est barré.

## v0.40 (3 octobre 2026)

- Royal Visit (et les effets qui rayent une icône de coût) : après avoir touché la carte visée, les icônes de son coût d'amélioration clignotent ; on touche celle à rayer, sans fenêtre. L'icône rayée porte une croix au feutre, comme les cases cochées (positions des icônes mesurées sur les images ; quelques boîtes très chargées peuvent être approximatives).
- Purge (et tout choix de cartes dans une fenêtre) : maintenir une carte appuyée l'ouvre en grand, recto et verso.

## v0.39 (3 octobre 2026)

- Priest, Cardinal et les effets « upgrade 1 card in play » : on touche l'effet, puis la carte à améliorer (les cartes possibles s'allument), puis les cartes à défausser s'il y en a. Le coût de l'effet et celui de l'amélioration se paient ensemble, aussi avec des cartes engagées ; le tour continue. Avant, un menu s'ouvrait et l'amélioration ne pouvait pas se payer avec la production des cartes en jeu.
- Pouvoir impossible pour l'instant (Lost Civilization sans 6 cartes amies, effet épuisé, ressources qui manquent…) : la carte fait « non » en rouge, comme un ennemi qui interdit un geste ; quand des ressources manquent, ce qui manque s'affiche aussi.

## v0.38 (3 octobre 2026)

- Cases à cocher : une croix au feutre noir sur chaque case cochée, à sa place sur la carte (positions des 37 étapes à cases mesurées sur les images). Le compteur « ☑ n/N » disparaît.
- C'est la case touchée qui est cochée et qui donne son bonus (Merchant, Jester, Mercenary, Lord Aethan, Prison, Astronomer…) : toucher une case lance l'effet ; pour une 2e case, les cases possibles clignotent, toucher ailleurs = non.
- Pistes à ordre imposé (Army, Treasury, Quests, Young Forest…) : la prochaine case libre est entourée d'un léger halo ; toucher une case de la piste lance l'effet.
- Cartes permanentes : la pastille passe sous la carte, la piste reste visible.

## v0.37 (3 octobre 2026)

- Mini-extensions 136, 137, 138 : une fois la partie terminée, la fenêtre de fin propose de jouer Prosperity, The Water Mill ou Border Dispute (une seule fois chacune, les jouées sont grisées). Purge 12 (une carte amie par paquet de 12), purge d'une carte permanente, puis 4 manches sans découverte de début de manche ; la carte d'extension change d'étape à chaque fin de manche. Tous les effets des 12 étapes sont automatisés.
- Purge : la gloire des cartes purgées s'ajoute au score pour toujours ; Aethan Estate peut sauver des cartes de la purge, Temple of Light vaut +10 {fame} par case cochée.
- Chemin de score : score de la partie de base, puis après chaque mini-extension.
- Cartes qui en gardent d'autres en jeu (Shrine, Temple, Villa…) : les ennemis et les cartes qui restent déjà en jeu ne sont plus proposés ; une carte gardée reste à sa place, en carte entière (elle passait dans la ligne du haut, coupée). Avec deux cartes de ce type, la seconde ne propose plus les cartes déjà gardées.

## v0.36 (3 octobre 2026)

- Choix de cartes sur le plateau (Skilled Bandit qui bloque 3 cartes, cible d'un effet, coût en personnes) : une carte choisie a un contour vert et une coche, bien distincte des cartes encore possibles, et un compteur en haut dit combien sont choisies (« 3 cartes bloquées 2/3 »). Avant, rien ne montrait qu'une carte était choisie, et la toucher une deuxième fois l'annulait : le choix semblait bloqué.
- Carte détruite : elle apparaît au milieu de l'écran, se brise en deux et ses moitiés tombent vers le bas.
- Même pouvoir sur plusieurs cartes (Shallow Mine 05 et 06…) : vérifié par un test, utiliser l'une ne barre pas l'autre tant qu'une carte reste à découvrir.

## v0.35 (3 octobre 2026)

- Carte découverte par un effet (Magistrate → Border 130…) : présentée dans la fenêtre « Nouvelle carte » (recto et verso), bouton « Ajouter au deck » en bas à droite.
- Une carte découverte arrive toujours côté recto : plus de choix recto / verso, sauf pour les cartes 38 à 42 (le parchemin 37 le demande).
- Amélioration qui coûte des cartes (109 : « 1 Person », « 2 Persons ») : plus de menu ; les cartes possibles s'allument et on touche celle(s) à défausser.
- Brick Road / Stone Street (43) : une fois 109-110 (ou 111-112) sorties de la boîte, l'effet est barré et ne se lance plus.
- Toucher un effet : sur une carte à plusieurs effets, la zone de texte est partagée entre les effets utilisables, le plus proche du doigt l'emporte ; un toucher sur une ligne de texte vise toujours l'effet. Aussi pour les cartes permanentes.
- Les stickers et traits de la moitié basse sont grisés avec elle.
- Fenêtres trop hautes (choix d'une carte parmi beaucoup) : elles tiennent dans l'écran et défilent au doigt.
- Stats : toucher « Découvertes » affiche toutes les cartes par numéro, vert découverte, rouge détruite, gris inconnue ; toucher une carte connue l'inspecte.

## v0.34 (3 octobre 2026)

- Carte à plusieurs effets (Witch Cabin…) : toucher le texte d'un effet lance cet effet-là, sans menu.
- Effet qui demande de choisir des cartes en jeu (« Destroy 1 person… », « Discard 1 person… ») : plus de fenêtre, les cartes possibles s'allument et on touche celle(s) qu'on veut ; toucher ailleurs annule.
- Cartes à image pleine : le numéro d'étape est dans le coin inférieur gauche.

## v0.33 (3 octobre 2026)

- Carte permanente dont on a choisi la face (objectifs) : l'inspection ne montre que cette face.
- Pastilles des pistes (Army, Treasury…) sur deux lignes, le coût au-dessus de la gloire : plus étroites, elles ne se chevauchent plus.
- Cartes permanentes triées : à gauche celles où l'on accumule des ressources (Army, Treasury, Export, A Perfect Tower…), à droite les objectifs, les autres entre les deux.
- Nouvelles cartes de la manche : recto et verso de chacune côte à côte, les cartes l'une au-dessus de l'autre.

## v0.32 (3 octobre 2026)

- Bouton « bug » dans la barre du haut (en partie, au-dessus des fenêtres, et sur « Mes royaumes ») : on décrit le problème, il est enregistré avec la partie (rejouable), son état et ce qui était ouvert à l'écran. « Partager » envoie le fichier de tous les bugs (Mail, Fichiers, AirDrop…), « Copier » le met dans le presse-papiers. Il remplace le lien « signaler un bug » vers GitHub.
- Geste interdit par un ennemi : la carte responsable secoue la tête (« non ») avec un contour rouge. Avancer sous Dark Prince ou Rain, améliorer ou utiliser un effet {time} sous Dark Prince, toucher une carte bloquée (sa bloquante tremble).

## v0.31 (3 octobre 2026)

- Effets épuisés : un trait de feutre par ligne de texte, à sa place et à sa largeur (Mason : ses deux lignes). Les lignes de chaque effet ont été mesurées sur les images des cartes (`npm run text-lines`).
- Les traits apparaissent partout où la carte est dessinée : zone de jeu, défausse, pioche, inspection, nouvelles cartes, choix d'une carte, carte qui pose une question.

## v0.30 (3 octobre 2026)

- Bug : sur les cartes qui ont un recto à image pleine et un verso à deux étapes (Mason 43, et 28, 32, 45, 58, 61, 66, 67), toucher le texte de l'effet en bas de l'image ne lançait rien. Les zones, la traduction FR, les traits des effets épuisés et la demi-carte se règlent maintenant sur la face visible.

## v0.29 (3 octobre 2026)

- Export : toujours le maximum ; toutes les cartes engagées qui produisent des {tradeGood} produisent, et tout part dans Export, sans question.
- Effets épuisés barrés d'un trait de feutre noir sur la carte, et plus proposés : effet à usage unique déjà utilisé, découverte dont les cartes ont toutes quitté la boîte (ex. Discover Missionary (103) une fois 103 découverte), cases à cocher toutes remplies.

## v0.28 (3 octobre 2026)

- Export : se paie aussi avec des cartes engagées, ou en touchant Export puis les cartes qui brillent ; on choisit ensuite combien de {tradeGood} y dépenser.
- Mode FR (bouton FR) : toucher une carte pose la traduction de la moitié touchée sur la carte elle-même, sans jouer ; décocher FR l'efface. Plus d'infobulle ni de traduction dans le menu des cartes. Une carte permanente touchée en mode FR s'ouvre en grand, traduisible.
- Action impayable : « Il manque … » s'affiche sur la carte quelques secondes, plus de fenêtre.
- Toucher le fond de la zone de jeu annule le choix des cartes qui paient (ou de la cible).

## v0.27 (3 octobre 2026)

- Toucher une amélioration ou un effet impayable ouvre le menu de la carte, qui dit ce qui manque, avec la mention « la carte ne peut pas payer avec sa propre production » quand c'est le cas (une carte qui produit est défaussée : elle ne peut pas aussi s'améliorer).

## v0.26 (2 octobre 2026)

- Bug : payer avec plusieurs cartes engagées dont la production dépend des autres (Cathedral : +1 {coin} par personne) échouait sans rien dire. Le paiement produit maintenant carte par carte, dans le meilleur ordre.
- Plus aucune fenêtre de confirmation (elle s'ouvrait avant un effet de temps qui fait perdre des ressources, et passait pour un blocage) ; « Annuler » reste possible.
- Merchant, Jester, Lord Aethan, Lord Nimrod, Mercenary, Astronomer : on choisit librement la ou les cases à cocher (or, bois, pierre, métal…).
- Vérification automatique : dans des parties jouées au hasard, chaque effet et chaque amélioration permis par les règles est proposé sur sa carte et payable en touchant les cartes qui brillent.

## v0.25 (2 octobre 2026)

- Stats : toucher « Détruites » montre les cartes détruites.
- Demi-cartes seulement pour les cartes « Stays in play ».
- Cartes à image pleine : plus de moitié basse grisée ni de numéro d'étape en double.
- Un seul compteur de ressources (fond gris) : par ressource, ce qu'on a plus ce que les cartes en jeu peuvent produire ; l'icône est entourée de vert quand une partie est déjà gagnée (production, effet, carte engagée).

## v0.24 (2 octobre 2026)

- Cartes à image pleine (une étape par face, ex. Field Worker #13, Bandit) : toucher le texte en bas de la carte utilise l'effet ; la traduction FR s'affiche aussi en touchant le bas.
- Choisir parmi 3 ou 4 cartes à découvrir : 2 cartes (recto + verso) par rangée ; appui long pour l'inspection.
- Carte découverte par un effet : elle arrive du centre de l'écran vers la défausse. Nouvelles cartes de début de manche : elles partent du centre vers la pioche avant le mélange.

## v0.23 (2 octobre 2026)

- Army, Treasury et les autres pistes : la pastille montre le palier suivant (« 3 {sword} → {fame}7 ») ; toucher la carte utilise son effet, ou fait briller les cartes qui peuvent payer, ou dit ce qui manque.
- Fenêtres translucides : on voit ses cartes à travers pour choisir.
- Stickers dessinés sur la carte, sur la moitié de leur stage, juste après les ressources imprimées et à leur taille.
- Cartes au dernier stage et cartes « Stays in play » : seule la moitié haute est montrée en jeu (gain de place). Pas pour les cartes à image pleine, dont le texte est en bas.

## v0.22 (2 octobre 2026)

- Ligne du haut de la zone de jeu : les ennemis, puis, un peu à l'écart, les cartes qui restent en jeu (« Stays in play »). Seules sur leur ligne quand la place le permet, sinon en tête de rangée.

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
