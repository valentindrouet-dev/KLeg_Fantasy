from common import *
FOUR = "Flèches rouges sur les deux faces : à la découverte, choix entre le recto (stage 1) et le verso (stage 4)."
card(100, [
    S(1, "Saw Mill", "Building", prod_="wood wood wood", fame=3, up=[("wood wood wood", "rotate")]),
    S(2, "Wood Industry", "Building", prod_="wood wood wood wood", fame=3, effects=[(A, "Discover Build an Ark (91).")]),
    S(3, "Wood Shipment", "Seafaring,Ship", prod_="wood wood/tradeGood tradeGood", fame=6,
      effects=[(P_, "{tradeGood} and {wood} may be used interchangeably.")]),
    S(4, "Wood Export", "Building", prod_="tradeGood tradeGood", fame=4, up=[("coin coin coin coin", "rotate")])],
    conf=0.9, choose=True, verify=[FOUR])
card(101, [
    S(1, "Ploughs", "Land,Invention", prod_="coin coin coin", fame=4, up=[("wood wood wood wood", "rotate")]),
    S(2, "Farming Machines", "Land,Invention", prod_="coin coin coin coin", fame=8, stay=True),
    S(3, "Royal Storehouse", "Building", fame=5, stay=True,
      effects=[(TO, "End of Turn: Make another card stay in play.")],
      text="{passive} Stays in play. {triggeredOptional} End of Turn: Make another card stay in play."),
    S(4, "Larger Barns", "Building", prod_="coin coin", fame=3, up=[("wood stone metal wood stone metal", "rotate")],
      effects=[(TO, "End of Turn: Make this or another card stay in play.")])],
    conf=0.9, choose=True, verify=[FOUR, "Ploughs / Farming Machines : bandeau bicolore vert et rose (Land - Invention) ; category=land."])
card(102, [
    S(1, "Fishing Ships", "Seafaring,Ship", prod_="coin coin coin", fame=2, up=[("wood wood coin metal", "rotate")]),
    S(2, "Fish n' Chips", "Seafaring", prod_="tradeGood tradeGood coin coin", fame=4),
    S(3, "Fishing Excellence", "State", cat="other", fame=13, perm=True,
      effects=[(P_, "Each seafaring card has +{coin} production.")],
      text="This card is Permanent. {passive} Each seafaring card has +{coin} production."),
    S(4, "Fish Quota", "Seafaring", prod_="coin coin", fame=4, boxes=4, effects=[(A, "Mark 1 {mark}. When complete, {rotate}.")])],
    conf=0.9, choose=True, verify=[FOUR])
card(103, [
    S(1, "Missionary", "Person", up=[("coin coin coin", "flip")], effects=[(A, "Spend {coin}{coin}{coin} to convert ({flip}) a Bandit.")]),
    S(4, "Beekeeper", "Person", prod_="coin", fame=2, boxes=4, up=[("", "flip")],
      effects=[(A, "Mark 1 {mark}. When complete, add sticker 1 as production here.")])],
    conf=0.9, verify=["Beekeeper : amélioration gratuite (boîte sans icône) pour revenir à Missionary."])
up_ = "card in play, paying as normal. This does NOT end your turn."
card(104, [
    S(1, "Priest", "Person", up=[("coin coin coin coin coin coin tradeGood tradeGood", "flip")],
      effects=[(A, "Spend {coin}{coin} to upgrade 1 " + up_)]),
    S(4, "Cardinal", "Person", fame=5, effects=[(A, "Upgrade 1 " + up_)])])
card(105, [
    S(1, "Small Hill Town", "Land", fame=6, up=[("wood wood stone stone", "rotate")],
      effects=[(A, "Spend {coin}{coin} to gain any 1 resource.")]),
    S(2, "Hill Town", "Land", fame=8, up=[("wood stone wood stone wood stone", "flip")],
      effects=[(A, "Spend {coin} to gain any 1 resource.")]),
    S(3, "Large Town", "Land", fame=10, up=[("wood " * 6, "rotate")],
      effects=[(A, "Spend any 1 resource to gain any 1 resource.")]),
    S(4, "City on a Hill", "Land", fame=12,
      effects=[(A, "Undiscover this to discover Camelot (106). (Put it back into the box. It may be discovered again.)"),
               (A, "Gain any 1 resource.")])])
card(106, [
    S(1, "Camelot", "Building", fame=15, up=[("wood wood stone stone stone stone", "rotate")]),
    S(2, "Camelot", "Building", fame=20, up=[("metal stone metal stone wood stone", "flip")]),
    S(3, "Camelot", "Building", fame=30, up=[("metal metal metal stone stone stone stone stone stone", "rotate")]),
    S(4, "Camelot", "Building", fame=40, fameVariable=True, boxes=8,
      effects=[(TO, "End of Turn: If you have no cards in your deck, mark 1 {mark}.")],
      text="{triggeredOptional} End of Turn: If you have no cards in your deck, mark 1 {mark}. {asterisk}Worth +5{fame} per {mark}.")],
    conf=0.9, verify=["Camelot stage 4 : 40 de gloire + 5 par case cochée (8 cases)."])
royal_visit(107)
card(108, [
    S(1, "Ether Crystal", "Artifact", cat="other", fame=10, perm=True, cannotBeDestroyed=True, cannotBePurged=True,
      text="This card cannot be destroyed.", flavor="The effect of this magical artifact is yet to be discovered.")],
    conf=0.9, verify=[BACK, "cannotBePurged=true d'après l'aide du site (« Since it cannot be destroyed, it cannot be selected in a purge »), non imprimé sur la carte."])
card(109, [
    S(1, "Small Guild", "Building", prod_="coin", up=[("wood wood !1_Person", "rotate")]),
    S(2, "Guild", "Building", prod_="coin/wood", fame=2, up=[("stone stone !2_Persons", "flip")]),
    S(3, "Guild Hall", "Building", prod_="coin/wood/stone", fame=3, up=[("stone stone stone stone", "rotate")]),
    S(4, "Grand Guild Hall", "Building", prod_="coin wood stone", fameVariable=True,
      boxes=[{"text": "Write the number of persons discarded; worth that many {fame}."}] * 3,
      effects=[(A, "Discard any number of persons to write that number in 1 {fame}.")])],
    conf=0.85, verify=["Grand Guild Hall : 3 rubans de gloire vides où l'on écrit un nombre ; modélisés comme 3 cases à valeur libre (à scripter).",
                       "Coûts mixtes : « 1 Person » + 2 bois, « 2 Persons » + 2 pierres ; la partie personnes est dans otherCost."])
card(110, [
    S(1, "Barn", "Building", prod_="coin", up=[("wood wood wood", "rotate")]),
    S(2, "Large Barn", "Building", prod_="coin/wood", fame=2, up=[("wood " * 6, "flip")]),
    S(3, "Countryside", "Land", prod_="coin wood", fame=3, up=[("wood " * 6, "rotate")],
      effects=[(A, "Put a card in play at the bottom of your deck.")]),
    S(4, "Thriving Countryside", "Land", prod_="coin coin wood", fame=5,
      effects=[(A, "Choose 1 card in play or discard pile. Put it at the bottom of the deck.")])])
x = (TF, "After this produces, cross out 1 production here.")
card(111, [
    S(1, "Manor", "Building", prod_="coin " * 6, up=[("wood wood wood", "rotate")], effects=[x]),
    S(2, "Large Manor", "Building", prod_="coin " * 6, up=[("stone stone stone", "flip")], effects=[x]),
    S(3, "Noble Residence", "Building", prod_="coin " * 6, up=[("stone stone stone stone", "rotate")], effects=[x]),
    S(4, "Grand Residence", "Building", prod_="coin coin coin", fame=5, effects=[(T, "Discover a nobleman (116).")])])
h = "Spend {coin}{coin} to discover a horse (%d)."
card(112, [
    S(1, "Stable", "Building", up=[("wood wood wood", "rotate")], effects=[(T, h % 113)]),
    S(2, "Stable", "Building", up=[("stone stone stone", "flip")], effects=[(T, h % 114)]),
    S(3, "Large Stable", "Building", up=[("coin coin coin coin", "rotate")], effects=[(T, h % 115)]),
    S(4, "Groom", "Person",
      effects=[(TO, "When played, play a horse from discard pile."),
               (A, "Choose a horse with 0-3 production. Spend {coin}{coin} to add any 1 resource sticker to it.")])],
    conf=0.9, verify=["Groom : premier effet avec éclair jaune (triggeredOptional) sur l'image ; le glossaire du site ne liste que Activated Effect."])
card(113, [S(1, "Horse", "Livestock,Horse", prod_="coin")], verify=[BACK])
