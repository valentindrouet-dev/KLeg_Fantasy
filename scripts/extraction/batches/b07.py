from common import *
card(73, [
    S(1, "West Canyon", "Land", prod_="stone/metal", up=[("stone stone stone", "flip"), ("stone metal coin wood", "rotate")]),
    S(2, "Miners", "Person", prod_="stone metal", fame=2, up=[("sword sword", "flip")],
      text="{asterisk}May be counted as 2 persons."),
    S(3, "Forced Labour", "State", cat="other", prod_="stone stone metal metal", fame=-3),
    wall()],
    conf=0.9, verify=["Miners : « *May be counted as 2 persons » est une règle sans icône d'effet, gardée dans le texte seulement (à scripter).",
                      "Forced Labour : bandeau rose (category=other), mot-clé « State », gloire -3."])
def shore(n):
    card(n, [
        S(1, "Shore", "Land", prod_="coin", up=[("wood wood wood coin", "rotate")]),
        S(2, "Shipyard", "Building", prod_="coin/wood", fame=3, up=[("coin wood wood wood wood", "flip")]),
        S(3, "Trade Ship", "Seafaring,Ship", prod_="coin/wood/tradeGood", fame=6, up=[("!2_Persons wood wood coin", "rotate")]),
        S(4, "Trade Route", "Seafaring,Ship", prod_="coin/wood/metal/tradeGood", fame=13,
          effects=[(TF, "When played, discover Pirate (76).")])],
        conf=0.9, verify=["Trade Ship : coût d'amélioration mixte « 2 Persons » + 2 bois + 1 or ; la partie « 2 Persons » est dans otherCost."])
shore(74); shore(75)
p = "Spend {sword}{sword} to defeat ({destroy}), then discover Lagoon (77)."
card(76, [
    S(1, "Pirate", "Enemy", fame=-2, stay=True, up=[("coin coin coin coin metal", "flip")], defeat=defeat("destroy", 2, p),
      effects=[(P_, "All cards have 1 less {coin} production, and effects give 1 less {coin}."), (A, p)],
      text="{passive} Stays in play. {passive} All cards have 1 less {coin} production, and effects give 1 less {coin}. {activated} " + p),
    S(4, "Skilled Ally", "Person,Seafaring", prod_="sword/metal", fame=3, effects=[(A, "Discover Treasure Hunt (93).")])],
    conf=0.9, verify=["Skilled Ally : bandeau bicolore bleu et jaune (Person - Seafaring) ; category=person, les deux mots-clés sont conservés."])
card(77, [
    S(1, "Lagoon", "Land", prod_="coin", up=[("stone stone tradeGood stone", "flip"), ("wood wood wood", "rotate")]),
    S(2, "Raft", "Seafaring", up=[("", "flip")]),
    S(3, "Lush Island", "Land,Seafaring", prod_="coin coin tradeGood", fame=1),
    S(4, "Sea Gate Wall", "Building", prod_="sword", fame=3, effects=[(A, "Play a seafaring card from discard pile.")])],
    conf=0.85, verify=["Lagoon : coût vers Sea Gate Wall lu comme 3 pierres + 1 marchandise (petites icônes) : à vérifier.",
                       "Raft : amélioration gratuite (boîte sans icône) vers Lush Island.",
                       "Lush Island : bandeau bicolore vert et bleu (Land - Seafaring) ; category=land."])
card(78, [
    S(1, "Statue", "Building", fame=2, up=[("stone stone stone stone", "rotate")]),
    S(2, "Monument", "Building", fame=5, up=[("wood wood stone stone stone stone", "flip")]),
    S(3, "Obelisk", "Building", fame=10, up=[("coin " * 6, "rotate")]),
    S(4, "Golden Pillar", "Building", fame=15)])
card(79, [
    S(1, "Villa", "Building", up=[("wood wood stone stone", "rotate")],
      effects=[(TO, "End of Turn: Discard to make 1 person stay in play.")]),
    S(2, "Estate", "Building", fame=3, up=[("wood wood stone stone stone stone", "flip")],
      effects=[(TO, "End of Turn: Discard to make 2 persons stay in play.")]),
    S(3, "Mansion", "Building", fame=7, up=[("stone coin coin stone coin coin", "rotate")],
      effects=[(TO, "End of Turn: Discard to make 1 other card stay in play.")]),
    S(4, "Palace", "Building", fame=12, effects=[(TO, "End of Turn: Discard to make 2 other cards stay in play.")])])
card(80, [
    S(1, "Cooperation", "Event", cat="other", effects=[(A, "Discard 2 persons to gain any 3 resources, then {flip}.")]),
    S(4, "Favor", "Event", cat="other", stay=True, effects=[(A, "Gain any 1 resource, then {flip}.")],
      text="{passive} Stays in play. {activated} Gain any 1 resource, then {flip}.")])
sv = lambda k: "When you purge this card, you may save %d other card%s from being purged." % (k, "" if k == 1 else "s")
card(81, [
    S(1, "Aethan Estate", "Land", up=[("wood wood stone stone", "rotate")]),
    S(2, "Aethan Estate", "Land", fame=3, up=[("wood wood wood wood", "flip")], effects=[(TF, sv(1))]),
    S(3, "Aethan Estate", "Land", fame=6, up=[("wood wood wood stone stone stone", "rotate")], effects=[(TF, sv(2))]),
    S(4, "Aethan Estate", "Land", fame=10, effects=[(TF, sv(3))])],
    conf=0.9, verify=["Icône d'effet = éclair rouge (triggeredForced) sur l'image, alors que le glossaire du site dit encore Passive Effect ; le texte dit « you may »."])
def shrine(n):
    st = lambda k: "End of Turn: Discard to make %s stay in play." % k
    card(n, [
        S(1, "Shrine", "Land", fame=3, up=[("coin coin coin", "rotate")], effects=[(TO, st("1 other card"))]),
        S(2, "Sanctuary", "Building", fame=5, up=[("stone coin stone coin coin", "flip")], effects=[(TO, st("up to 2 other cards"))]),
        S(3, "Oratory", "Building", fame=9, up=[("coin coin wood wood stone stone", "rotate")], effects=[(TO, st("up to 3 other cards"))]),
        S(4, "Temple", "Building", fame=15, effects=[(TO, st("up to 4 other cards"))])])
shrine(82); shrine(83)
def mine(n):
    card(n, [
        S(1, "Mine", "Building", prod_="stone metal", fame=4, up=[("wood wood wood", "rotate")]),
        S(2, "Deep Mine", "Building", prod_="stone metal metal", fame=6, up=[("coin wood coin wood wood", "flip")]),
        S(3, "Ruby Mine", "Building", prod_="stone metal metal tradeGood", fame=9, up=[("stone stone wood wood coin coin", "rotate")]),
        S(4, "Diamond Mine", "Building", prod_="stone metal metal tradeGood tradeGood", fame=13)])
mine(84); mine(85)
