from kl import *
A, P_, D, TF = "activated", "passive", "destroy", "triggeredForced"
card(11, [
    S(1, "Jungle", "Land", up=[("coin coin coin", "rotate")], effects=[(A, "Spend {coin} to gain {wood}.")]),
    S(2, "Huge Trees", "Land", prod_="wood", up=[("coin coin coin", "flip")], effects=[(A, "Spend {coin} to gain {wood}{wood}.")]),
    S(3, "Deep Jungle", "Land", prod_="wood wood", up=[("wood wood wood wood", "rotate")]),
    S(4, "Treehouses", "Building", prod_="coin wood wood", fame=4, stay=True)])
card(12, [
    S(1, "River", "Land", prod_="coin", up=[("wood wood wood", "rotate")]),
    S(2, "Bridge", "Land", prod_="coin", fame=2, up=[("stone stone stone", "flip")]),
    S(3, "Stone Bridge", "Land", prod_="coin", fame=4, up=[("coin coin", "rotate")]),
    S(4, "Explorers", "Person", prod_="coin", fame=4,
      effects=[(A, "Discover a new region (71 / 72 / 73 / 74). Then {rotate}.")])])
card(13, [
    S(1, "Field Worker", "Person", effects=[(A, "Choose a land in play. Gain its production as resources.")]),
    S(4, "Servant", "Person", effects=[(A, "Gain {coin} / {wood} / {stone}.")])], choose=True)
def bandit(n, back_name, back_text):
    card(n, [
        S(1, "Bandit", "Enemy", fame=-2,
          effects=[(TF, "When played, blocks 1 card with {coin} production."),
                   (A, "Spend {sword} to defeat ({destroy}) and gain any 2 resources.")],
          text="{triggeredForced} When played, blocks 1 card with {coin} production. {activated} Spend {sword} to defeat ({destroy}) and gain any 2 resources. (Can be {flip} by a Missionary)",
          defeat={"kind": "destroy", "cost": ["sword"], "text": "Spend {sword} to defeat ({destroy}) and gain any 2 resources."}),
        S(4, back_name, "Person", effects=[(A, back_text)])],
        conf=0.9, verify=["Bandit : la mention « (Can be {flip} by a Missionary) » n'est pas un effet de cette carte ; elle est gardée dans le texte seulement."])
bandit(14, "Worker", "Choose a building in play. Gain its production as resources.")
bandit(16, "Field Worker", "Choose a land in play. Gain its production as resources.")
card(15, [
    S(1, "Distant Mountain", "Land", prod_="coin", up=[("coin coin", "rotate")]),
    S(2, "Rocky Area", "Land", prod_="stone", up=[("wood coin wood coin", "flip")],
      effects=[(A, "Spend {coin} to gain {stone}{stone}.")]),
    S(3, "Quarry", "Land", prod_="stone stone", up=[("wood wood coin coin", "rotate")]),
    S(4, "Shallow Mine", "Land", prod_="stone metal", fame=3, effects=[(D, "Discover Mine (84 / 85).")])])
card(17, [
    S(1, "Hill", "Land", prod_="coin", up=[("coin wood stone", "rotate")]),
    S(2, "Chapel", "Building", prod_="coin", fame=1, up=[("wood wood stone stone", "flip")],
      effects=[(A, "Spend {coin}{coin}{coin} to discover Missionary (103).")]),
    S(3, "Church", "Building", prod_="coin", fame=3, up=[("metal wood wood stone stone stone", "rotate")],
      effects=[(A, "Spend {coin}{coin}{coin}{coin} to discover Priest (104).")]),
    S(4, "Cathedral", "Building", prod_="coin", fame=7,
      effects=[(P_, "This card has +{coin} production for each person in play.")])])
card(18, [
    S(1, "East Cliffs", "Land", prod_="stone", up=[("stone stone stone", "flip"), ("stone metal wood metal", "rotate")]),
    S(2, "Smithy", "Building", prod_="metal", fame=1, up=[("metal metal coin coin", "flip")],
      effects=[(A, "Reset to discover Jewellery (90).")]),
    S(3, "Arsenal", "Building", prod_="metal", fame=4, effects=[(A, "Gain {sword} for each person in play.")]),
    S(4, "Wall", "Building", prod_="sword", fame=3, stay=True)])
card(19, [
    S(1, "Forest", "Land", prod_="wood", up=[("stone stone", "flip")],
      effects=[(A, "Gain {wood}{wood}{wood}, then {rotate}.")]),
    S(2, "Felled Forest", "Land", up=[("stone coin wood coin", "flip"), ("coin", "rotate")]),
    S(3, "Lumberjack", "Building", prod_="wood wood", fame=2),
    S(4, "Sacred Well", "Building", prod_="coin", fame=2, effects=[(D, "Discover Shrine (82 / 83).")])],
    verify=["Felled Forest : la seconde amélioration (1 pièce, flèche verticale) ramène au stage 1 Forest, d'après la géométrie de la carte."])
for n in (20, 21):
    card(n, [
        S(1, "Swamp", "Land", up=[("wood coin", "rotate")]),
        S(2, "Accessible Swamp", "Land", fame=1, up=[("coin coin wood", "flip")]),
        S(3, "Swamp Garden", "Land", prod_="coin", fame=3, up=[("coin wood wood", "rotate")]),
        S(4, "Exotic Fruit Trees", "Land", prod_="tradeGood tradeGood", fame=4)])
card(22, [
    S(1, "Lake", "Land", prod_="coin", up=[("stone stone stone stone", "flip"), ("stone stone wood", "rotate")]),
    S(2, "Fisherman's Cabin", "Building", prod_="coin", fame=1, up=[("wood wood wood", "flip")]),
    S(3, "Fishing Boat", "Seafaring", prod_="coin coin", fame=1, effects=[(A, "Discover Shore (75).")]),
    S(4, "Lighthouse", "Building", fame=5, stay=True, effects=[(P_, "Discard the top card of your deck.")],
      text="{passive} Stays in play. {passive} Discard the top card of your deck.")])
