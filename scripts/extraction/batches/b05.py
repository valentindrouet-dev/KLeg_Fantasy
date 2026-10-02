from common import *
SP = lambda who, n: "Spend {coin}{coin}{coin} to discover %s (%d)." % (who, n)
card(48, [
    S(1, "Envoy", "Person", up=[("coin coin coin", "rotate")], effects=[(T, SP("Trader", 119))]),
    S(2, "Emissary", "Person", fame=1, up=[("coin " * 6, "flip")], effects=[(T, SP("Investor", 120))]),
    S(3, "Diplomat", "Person", fame=2, up=[("coin " * 6, "rotate")], effects=[(T, SP("Ally", 121))]),
    S(4, "Ambassador", "Person", fame=5, effects=[(T, SP("Consort", 122))])])
card(49, [
    S(1, "Royal Architect", "Person", prod_="stone", up=[("!Destroy_Stone_Bridge", "flip")],
      effects=[(A, "Destroy one of the following cards in play to discover an improved version of it; Castle - discover card 123 Diamond Mine - discover card 124 Temple - discover card 125")]),
    S(4, "Bridge of Marvel", "Building", fame=15)],
    conf=0.9, verify=["Royal Architect : le coût d'amélioration est « Destroy Stone Bridge » (pas de ressources), saisi dans otherCost."])
card(50, [
    S(1, "Traveller", "Person", up=[("tradeGood " * 3, "rotate")], effects=[(T, "Discover Land (126).")]),
    S(2, "Traveller", "Person", up=[("tradeGood " * 3, "flip")], effects=[(T, "Discover Land (127).")]),
    S(3, "Traveller", "Person", up=[("tradeGood " * 5, "rotate")], effects=[(T, "Discover Land (128).")]),
    S(4, "Traveller", "Person", fame=2, effects=[(T, "Discover Land (129)."), (A, "Discard a land to gain any 2 resources.")])])
card(51, [
    S(1, "Magistrate", "Person", up=[("stone stone stone", "rotate")], effects=[(T, "Discover Border (130).")]),
    S(2, "Magistrate", "Person", up=[("metal stone metal stone", "flip")], effects=[(T, "Discover Border (131).")]),
    S(3, "Magistrate", "Person", fame=2, up=[("metal metal stone stone stone", "rotate")], effects=[(T, "Discover Border (132).")]),
    S(4, "Strategist", "Person,Elder", fame=5, effects=[(A, "Play 1 Wall or 1 knight from discard pile.")])])
card(52, [
    S(1, "Mighty Mound", "Land", up=[("wood wood wood", "rotate")]),
    S(2, "Hill Settlement", "Land", prod_="coin", fame=1, up=[("wood wood wood wood", "flip")]),
    S(3, "Hill Village", "Land", prod_="coin coin", fame=3, up=[("stone wood wood stone wood wood", "rotate")]),
    S(4, "Peak Village", "Land", prod_="coin coin tradeGood", fame=6,
      effects=[(A, "Reset to discover Town (105).")],
      text="{activated} Reset to discover Town (105). (Note: Town may be discovered a second time later.)")])
w1 = "Spend {sword}{sword}{sword}{sword} to defeat ({destroy})."
w4 = "Spend {sword}{sword}{sword} to defeat ({destroy})."
card(53, [
    S(1, "Witch", "Enemy", fame=-3, defeat=defeat("destroy", 4, w1),
      effects=[(A, w1), (A, "Discard 3 persons to {flip}."), (TF, "End of Turn: Discover the next 2 cards from your box, then {flip}.")]),
    S(4, "Witch Cabin", "Enemy", fame=-2, defeat=defeat("destroy", 3, w4),
      effects=[(A, w4), (A, "Destroy 1 person to {destroy}."), (TF, "End of Turn: discover the next 2 cards from your box, then {destroy}.")])])
card(54, [
    S(1, "Scribe", "Person", up=[("coin " * 5, "flip")], effects=[(TO, "End of Turn: Discard to make up to 2 other cards stay in play.")]),
    S(4, "Architect", "Person", prod_="stone", effects=[(T, "Reset to discover 1 building project (78 / 79).")])])
card(55, [
    S(1, "Lord Aethan", "Person", prod_="coin wood stone", fame=2,
      boxes=[G("coin", "coin"), G("coin", "coin"), G("wood", "wood"), G("wood", "wood"), G("stone", "stone"), G("tradeGood"), G("sword"), G("metal")],
      effects=[(A, "Discover Cooperation (80)."), (A, "Discover Estate (81)."), (P_, "Mark 1 {mark}.")]),
    S(4, "Lord Nimrod", "Person", prod_="sword", fame=5,
      boxes=[G("coin", "coin"), G("stone", "stone"), G("metal", "metal"), G("sword", "sword"), G("sword", "sword"), G("sword", "sword", "sword"), G("wood"), G("metal")],
      effects=[(T, "Discover Rival and Raid (133 & 134)."), (A, "Mark 1 {mark}.")])],
    conf=0.9, choose=True, verify=["Cases lues sur agrandissement : Aethan = 2 or, 2 or, 2 bois, 2 bois, 2 pierre, 1 marchandise, 1 épée, 1 métal ; Nimrod = 2 or, 2 pierre, 2 métal, 2 épées, 2 épées, 3 épées, 1 bois, 1 métal."])
card(56, [
    S(1, "Plague", "Event", cat="negative", fame=-2, stay=True,
      effects=[(TF, "End of Round: Destroy any 2 persons in your kingdom. Then {flip}.")],
      text="{passive} Stays in play. {triggeredForced} End of Round: Destroy any 2 persons in your kingdom. Then {flip}."),
    enemy_soldier()])
a = "Spend {sword}{sword}{sword} to defeat ({flip})."
card(57, [
    S(1, "Assassin", "Enemy", defeat=defeat("turn", 3, a),
      effects=[(TF, "Destroy the next person you play. If you do, {flip}."), (A, a)]),
    enemy_soldier()])
card(58, [
    S(1, "City Fire", "Event", cat="negative", stay=True,
      effects=[(TF, "End of Round: Destroy 1 building in your kingdom. Then {flip}.")],
      text="{passive} Stays in play. {triggeredForced} End of Round: Destroy 1 building in your kingdom. Then {flip}."),
    young_forest(), ashlands()],
    conf=0.9, verify=["Young Forest : 5 cases de haut en bas, dont 3 avec astérisque (1re, 3e, 5e), lues sur l'image."])
card(59, [
    S(1, "Mysterious Cave", "Land", up=[("!1_Person", "rotate")]),
    S(2, "Dungeon", "Land", fame=2, up=[("!2_Persons", "flip")]),
    S(3, "Lost Civilization", "Land", fame=5, up=[("metal metal coin", "rotate")],
      effects=[(A, "Discard 6 friendly cards in play to discover an artifact (108).")]),
    S(4, "Treasures", "Item,Loot", cat="other", prod_="coin coin", fame=8, stay=True)],
    conf=0.9, verify=["Coûts d'amélioration « 1 Person » et « 2 Persons » : pas des ressources, saisis dans otherCost ; la règle exacte (défausser des personnes ?) est à confirmer."])
