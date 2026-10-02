from common import *
card(128, [
    S(1, "Ravine", "Land", up=[("coin coin wood wood", "rotate")]),
    S(2, "Chasm", "Land", up=[("!2_persons", "flip")]),
    S(3, "Ancient Ruins", "Land", up=[("!3_persons", "rotate")]),
    S(4, "Excavation Site", "Land", prod_="coin tradeGood", fameVariable=True, boxes=7,
      effects=[(T, "Discard 1 person and spend {stone}{stone}{stone} to mark {mark}.")],
      text="{asterisk}Worth 7{fame} per {mark}. {time} Discard 1 person and spend {stone}{stone}{stone} to mark {mark}.")],
    conf=0.9, verify=["Coûts d'amélioration « 2 persons » et « 3 persons » saisis dans otherCost.",
                      "Excavation Site : 7 cases comptées sur l'image, gloire variable 7 par case cochée."])
card(129, [
    S(1, "Hot Springs", "Land", up=[("coin coin stone stone", "rotate")],
      effects=[(TO, "When you upgrade this, add sticker 1 to 1 land in play.")]),
    S(2, "Fountain", "Land", fame=2, up=[("wood stone wood stone", "flip")],
      effects=[(TO, "When you upgrade this, boost 1 production in play.")]),
    S(3, "Canals", "Land", fame=5, up=[("", "rotate")],
      effects=[(TO, "When you upgrade this, add sticker 7 to 1 land in play.")]),
    S(4, "Sweet Water River", "Land", fame=6)],
    conf=0.9, verify=["Canals : amélioration gratuite (boîte sans icône, vérifiée sur agrandissement)."])
card(130, [
    S(1, "Town Border", "Land", prod_="coin", up=[("stone stone stone stone", "flip"), ("wood wood wood coin", "rotate")]),
    S(2, "Watchtower", "Building", prod_="sword", fame=4, effects=[(P_, "You may look at the top 2 cards of your deck.")]),
    S(3, "Double Wall", "Building", prod_="sword sword", fameVariable=True, stay=True,
      text="{asterisk}Worth 4{fame} for each wall, including this. {passive} Stays in play."),
    S(4, "Inner Wall", "Building", prod_="sword", fame=3, stay=True, up=[("stone stone stone stone wood wood", "rotate")])],
    conf=0.9, verify=["Double Wall : gloire variable, 4 par carte dont le nom contient « Wall » (cette carte comprise)."])
card(131, [
    S(1, "North Plains", "Land", prod_="coin", up=[("stone stone stone stone", "flip"), ("stone stone stone coin", "rotate")]),
    S(2, "Moat", "Land", prod_="sword", fame=2, up=[("metal metal coin coin", "flip")],
      effects=[(A, "Discard another card to gain {sword}{sword}.")]),
    S(3, "Moat Bridge", "Building", prod_="sword", fame=3, effects=[(A, "Spend {coin} to play a person from discard pile.")]),
    wall()])
card(132, [
    S(1, "South Hills", "Land", prod_="coin", up=[("wood wood wood stone stone", "flip"), ("coin stone stone", "rotate")]),
    S(2, "Terraced Land", "Land", prod_="sword", fame=2, up=[("stone stone stone", "flip")]),
    wall(3),
    S(4, "Windmill", "Building", prod_="coin coin coin", fame=4)])
card(133, [
    S(1, "Raid", "Event", cat="other", up=[("sword sword", "rotate")], effects=[(A, "Gain any 1 resource.")]),
    S(2, "Looting", "Event", cat="other", up=[("sword sword sword", "flip")], effects=[(A, "Gain any 2 resources.")]),
    S(3, "Pillaging", "Event", cat="other", fame=3, up=[("sword " * 5, "rotate")], effects=[(A, "Gain any 2 resources.")]),
    S(4, "Plundering", "Event", cat="other", fame=5, effects=[(A, "Gain any 3 resources.")])])
card(134, [
    S(1, "Handsome Rival", "Person", fameVariable=True,
      boxes=[{"cost": ["coin"] * 4}, {"cost": ["sword"] * 2}, {"cost": ["sword"] * 3}, {"cost": ["tradeGood"] * 3}],
      effects=[(P_, "Cannot be destroyed unless Lord Nimrod has been destroyed."),
               (A, "Discard Lord Nimrod and spend the resources for 1 box below to mark {mark} it. When complete, {flip}.")],
      text="{passive} Cannot be destroyed unless Lord Nimrod has been destroyed. {activated} Discard Lord Nimrod and spend the resources for 1 box below to mark {mark} it. When complete, {flip}. {asterisk}Worth -5{fame} for each unmarked box."),
    S(4, "Noble Ally", "Person", fame=6, effects=[(A, "Choose a person in play and gain its production as resources.")])],
    conf=0.85, verify=["Handsome Rival : 4 cases avec coûts lus comme 4 or, 2 épées, 3 épées, 3 marchandises (petites icônes) : à vérifier.",
                       "Handsome Rival : indestructible sous condition (tant que Lord Nimrod n'est pas détruit) : effet passif à scripter, cannotBeDestroyed non posé.",
                       "Gloire variable : -5 par case non cochée."])
x = (P_, "Spend {sword}{sword}{sword}{sword} to cross out 1 {sword} cost here.")
card(135, [
    S(1, "Bordering Lands", "Enemy,Land", cat="negative", fameVariable=True, up=[("sword " * 10, "rotate")], effects=[x],
      text="{passive} Spend {sword}{sword}{sword}{sword} to cross out 1 {sword} cost here. {asterisk}All stages of this card are worth the same as the last stage."),
    S(2, "Occupation", "Event", cat="other", fameVariable=True, up=[("sword " * 9, "flip")], effects=[x]),
    S(3, "Unruly Towns", "Land", fameVariable=True, up=[("sword " * 8, "rotate")],
      effects=[x, (TF, "When upgraded, write \"20\" in an empty {fame} on that stage.")]),
    S(4, "Vassal States", "Land", fameVariable=True,
      boxes=[{"text": "Empty {fame}: write \"20\" when Unruly Towns is upgraded."}] * 9,
      effects=[(A, "Reset this.")])],
    conf=0.85, verify=["Coûts d'amélioration vérifiés sur agrandissement : 10, 9 et 8 épées.",
                       "Bordering Lands : bandeau bicolore rouge et vert, crâne (Enemy - Land) : category=negative, non amie ; aucune instruction de défaite.",
                       "Vassal States : 9 rubans de gloire vides, modélisés comme 9 cases valant 20 chacune une fois remplies ; tous les stages valent autant que le dernier (à scripter)."])
MINI = "Mini-extension : les changements de stage (« Then {rotate}/{flip} ») sont des effets de fin de manche, pas des améliorations."
card(136, [
    S(1, "Prosperity (expansion)", "Event", cat="other", perm=True,
      effects=[(P_, "Play 1 round where all friendly cards have +{coin} production. Then {rotate}.")],
      text="Play 1 round where all friendly cards have +{coin} production. Then {rotate}."),
    S(2, "Hoarding", "Event", cat="other", perm=True,
      effects=[(TO, "Play 1 round where you may make 1 card stay in play each turn. Then {flip}.")],
      text="Play 1 round where you may make 1 card stay in play each turn. Then {flip}."),
    S(3, "Uprising", "Event", cat="other", perm=True, boxes=8,
      effects=[(TF, "Play 1 round where you must mark 1 {mark} each time a person is played when there is already a person in play. Then {rotate}.")],
      text="Play 1 round where you must mark 1 {mark} each time a person is played when there is already a person in play. Then {rotate}."),
    S(4, "Royal Decree", "Event", cat="other", perm=True,
      effects=[(TF, "Play 1 round. Then, for each {mark} on Uprising, you must cross out 1 production on 1 card. Then destroy this.")],
      text="Play 1 round. Then, for each {mark} on Uprising, you must cross out 1 production on 1 card. Then destroy this.")],
    conf=0.85, verify=[MINI, "Aucune icône de type d'effet sur la carte : types repris du glossaire du site (stage 4 : triggeredForced d'après « you must »).",
                       "Uprising : 8 cases comptées sur l'image (2 rangées de 4)."])
card(137, [
    S(1, "The Water Mill (expansion)", "Invention", cat="other", perm=True,
      effects=[(P_, "Play 1 round where you may gain {coin}{coin}{coin} once per turn. Then {rotate}.")],
      text="Play 1 round where you may gain {coin}{coin}{coin} once per turn. Then {rotate}."),
    S(2, "Efficient Farming", "Event", cat="other", perm=True,
      effects=[(T, "Discard 2 buildings to add sticker 1 to 1 land in play.")],
      text="Play 1 round. {time} Discard 2 buildings to add sticker 1 to 1 land in play. Then {flip}."),
    S(3, "Surplus", "Event", cat="other", perm=True,
      effects=[(P_, "Play 1 round where lands that produce {coin} may produce {tradeGood} instead. Then {rotate}.")],
      text="Play 1 round where lands that produce {coin} may produce {tradeGood} instead. Then {rotate}."),
    S(4, "Obsolete Farms", "Event", cat="other", perm=True,
      effects=[(TF, "Play 1 round. Then destroy this and 1 card with {coin} production.")],
      text="Play 1 round. Then destroy this and 1 card with {coin} production.")],
    conf=0.85, verify=[MINI, "Stage 1 : « once per turn », aucune icône ni mot-clé de type sur le site ; classé passive.",
                       "Stage 4 : classé triggeredForced (fin de manche obligatoire), le site ne donne pas de type."])
card(138, [
    S(1, "Border Dispute (expansion)", "Event", cat="other", perm=True,
      effects=[(TF, "Play 1 round where all lands stay in play. Then {rotate}.")],
      text="Play 1 round where all lands stay in play. Then {rotate}."),
    S(2, "Espionage", "Event", cat="other", perm=True, boxes=6,
      effects=[(TF, "When a person is played, either mark 1 {mark} or discard 2 friendly cards. If complete, discard all cards in your deck.")],
      text="Play 1 round. Then {flip}. {triggeredForced} When a person is played, either mark 1 {mark} or discard 2 friendly cards. If complete, discard all cards in your deck."),
    S(3, "Attack", "Event", cat="other", perm=True,
      effects=[(TF, "End of Turn: If you have no {sword}, cross out 1 production on 1 card in play."),
               (TF, "End of Round: Add any resource sticker (1-6) to 1 friendly card, then {rotate}.")],
      text="Play 1 round. {triggeredForced} End of Turn: If you have no {sword}, cross out 1 production on 1 card in play. {triggeredForced} End of Round: Add any resource sticker (1-6) to 1 friendly card, then {rotate}."),
    S(4, "Resistance", "Event", cat="other", perm=True,
      effects=[(P_, "Play 1 round where you can spend any amount of {sword} and keep track of how many you have spent. After the round, write the amount (max 100) in sticker 16 and add that sticker to 1 land. Then destroy this.")],
      text="Play 1 round where you can spend any amount of {sword} and keep track of how many you have spent. After the round, write the amount (max 100) in sticker 16 and add that sticker to 1 land. Then destroy this.")],
    conf=0.85, verify=[MINI, "Espionage : 6 cases (2 rangées de 3) comptées sur l'image.",
                       "Resistance : compteur libre d'épées dépensées (lignes de pointage), non modélisé par des cases.",
                       "Resistance utilise le sticker 16 pour une gloire sur un terrain, alors que la spec réserve le sticker 16 à la gloire purgée : à clarifier avec le catalogue de stickers."])
card(139, [
    S(1, "STOP!", cat="none", text="STOP! This is the last card of the deck. It exists only to mark the backside of the deck."),
    S(4, "STOP!", cat="none", text="STOP! This is the backside of the deck.")],
    conf=0.9, parchment=True,
    verify=["Carte de fin de paquet, jamais découverte en jeu ; isParchment=true par analogie visuelle (fond parchemin).",
            "Le site nomme le stage 1 « Örjan » avec l'aide « Svensk text » (donnée de test du site) : ignoré, nom repris de l'image."])
