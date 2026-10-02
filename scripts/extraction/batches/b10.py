from common import *
card(114, [S(1, "Horse", "Livestock,Horse", prod_="sword")], verify=[BACK])
card(115, [S(1, "Horse", "Livestock,Horse", prod_="wood/stone")], verify=[BACK])
card(116, [
    S(1, "Aric Blackwood", "Person", prod_="coin coin", stay=True,
      effects=[(TF, "When played, you must discard any 1 card in play.")],
      text="{passive} Stays in play. {triggeredForced} When played, you must discard any 1 card in play."),
    S(4, "Eadric Shadowstrike", "Person", stay=True, effects=[(A, "Discard 1 person to gain {sword}{sword}{sword}.")],
      text="{passive} Stays in play. {activated} Discard 1 person to gain {sword}{sword}{sword}.")], choose=True)
card(117, [
    S(1, "Trade Relations", cat="other", perm=True,
      effects=[(P_, "Spend {tradeGood}{tradeGood}{tradeGood} to gain any 1 resource.")])],
    conf=0.9, verify=[BACK, "Bandeau rose avec la seule mention « Permanent » : aucun mot-clé de type, category=other."])
card(118, [
    S(1, "Small School", "Building", effects=[(T, "Upgrade a person in play for free, then {rotate}.")]),
    S(2, "School", "Building", effects=[(T, "Upgrade a person in play for free. Then {flip}.")]),
    S(3, "Prominent School", "Building", fame=4, effects=[(T, "Add 1 resource sticker (1-6) to a person in play, then {rotate}.")]),
    S(4, "Renowned School", "Building", fame=6, effects=[(T, "Add 1 resource sticker (1-6) to a person in play.", OT)])])
trader(119)
card(120, [
    S(1, "Investor", "Person,Lady", effects=[(A, "Gain any 3 resources, then {rotate}.")]),
    S(2, "Investor", "Person,Lady", effects=[(A, "Gain any 3 resources, then {flip}.")]),
    S(3, "Investor", "Person,Lady", effects=[(A, "Gain any 3 resources, then {rotate}.")]),
    S(4, "Investor", "Person,Lady", effects=[(A, "Gain any 1 resource.")])])
card(121, [
    S(1, "King Alahar", "Person", prod_="sword sword", fame=-5, stay=True),
    S(4, "Queen Jemimah", "Person,Lady", prod_="coin", fameVariable=True, boxes=7,
      effects=[(A, "Discard 1 person with 5 or more {fame} to mark 1 {mark} below.")],
      text="{activated} Discard 1 person with 5 or more {fame} to mark 1 {mark} below. {asterisk}Worth 3{fame} per {mark}.")],
    conf=0.85, choose=True, verify=["Queen Jemimah : 7 cases comptées sur l'image (rangée partiellement fondue dans le décor) : à vérifier."])
card(122, [
    S(1, "Royal Consort", "Person,Lady", prod_="coin tradeGood tradeGood"),
    S(4, "Royal Consort", "Person,Knight", prod_="wood stone")], choose=True)
pl = "Play 1 card from discard pile."
card(123, [
    S(1, "Grand Castle", "Building", prod_="sword", fame=15, up=[("wood wood stone stone metal metal", "rotate")], effects=[(A, pl)]),
    S(2, "Huge Castle", "Building", prod_="sword sword", fame=20, up=[("metal stone metal stone metal stone", "flip")], effects=[(A, pl)]),
    S(3, "Fortress", "Building", prod_="sword sword", fame=25, up=[("metal metal metal metal stone stone stone stone", "rotate")], effects=[(A, pl)]),
    S(4, "Impregnable Fortress", "Building", prod_="sword sword sword", fame=30,
      effects=[(A, pl), (TO, "You may discard 2 Walls instead of this.")])])
card(124, [
    S(1, "Jewel Extraction", "Event", cat="other", prod_="stone metal metal tradeGood tradeGood", fame=15, up=[("wood wood metal metal", "rotate")]),
    S(2, "Jewel Cutting", "Event", cat="other", prod_="metal metal tradeGood tradeGood tradeGood", fame=18, up=[("metal wood metal wood wood", "flip")]),
    S(3, "Jewel Polishing", "Event", cat="other", prod_="metal metal metal tradeGood tradeGood tradeGood tradeGood", fame=21, up=[("wood wood metal metal metal metal", "rotate")]),
    S(4, "Jewel Exhibit", "Event", cat="other", prod_="metal metal metal " + "tradeGood " * 6, fame=25)],
    conf=0.9, verify=["Productions à nombreuses icônes (jusqu'à 9) lues sur l'image : à vérifier."])
t5 = (TO, "End of Turn: Discard to make up to 5 other cards stay in play.")
card(125, [
    S(1, "Large Temple", "Building", fame=18, up=[("coin tradeGood coin tradeGood coin tradeGood", "rotate")], effects=[t5]),
    S(2, "Ornate Temple", "Building", fame=22, up=[("coin stone tradeGood coin stone tradeGood coin stone tradeGood", "flip")], effects=[t5]),
    S(3, "Legendary Temple", "Building", fame=28, up=[("tradeGood " * 8, "rotate")], effects=[t5]),
    S(4, "Temple of Light", "Building", fame=30, fameVariable=True, boxes=4,
      effects=[t5, (T, "Spend {tradeGood}{tradeGood}{tradeGood}{tradeGood} to mark {mark}.")],
      text="{triggeredOptional} End of Turn: Discard to make up to 5 other cards stay in play. {time} Spend {tradeGood}{tradeGood}{tradeGood}{tradeGood} to mark {mark}. {asterisk}When you purge this, it is worth +10{fame} per {mark}.")],
    conf=0.9, verify=["Temple of Light : le bonus de +10 par case ne compte qu'à la purge (texte + aide du site), pas dans le score du royaume."])
card(126, [
    S(1, "Pine Forest", "Land", prod_="wood", up=[("coin coin metal", "rotate")]),
    S(2, "Pine Forest", "Land", prod_="wood wood", fame=1),
    S(3, "Fish Pond", "Land", prod_="coin coin tradeGood", fame=1),
    S(4, "Pond", "Land", prod_="coin", up=[("wood wood wood wood", "rotate")])], conf=0.9, choose=True, verify=[FOUR])
card(127, [
    S(1, "Boulders", "Land", prod_="stone", up=[("metal metal", "rotate")]),
    S(2, "Boulders", "Land", prod_="stone stone", fame=1),
    S(3, "Mushrooms", "Land", prod_="tradeGood", effects=[(P_, "Discard 1 person to gain {tradeGood}{tradeGood}.")]),
    S(4, "Mushrooms", "Land", prod_="tradeGood", up=[("!2_persons", "rotate")])],
    conf=0.9, choose=True, verify=[FOUR, "Mushrooms (stage 4) : coût d'amélioration « 2 persons » saisi dans otherCost."])
