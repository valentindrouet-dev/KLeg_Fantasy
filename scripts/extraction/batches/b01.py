from kl import *
A, P_, D = "activated", "passive", "destroy"
for n in (1, 2, 3, 4):
    card(n, [
        S(1, "Wild Grass", "Land", prod_="coin", up=[("coin coin", "rotate")]),
        S(2, "Plains", "Land", prod_="coin", up=[("coin coin coin", "flip")],
          effects=[(A, "Discard a friendly card to gain {coin}{coin}.")]),
        S(3, "Farmlands", "Land", prod_="coin coin", up=[("wood wood wood", "rotate")]),
        S(4, "Food Barns", "Building", prod_="coin coin", fame=3, stay=True)])
for n in (5, 6):
    card(n, [
        S(1, "Distant Mountain", "Land", prod_="coin", up=[("coin coin", "rotate")]),
        S(2, "Rocky Area", "Land", prod_="stone", up=[("wood coin wood coin", "flip")],
          effects=[(A, "Spend {coin} to gain {stone}{stone}.")]),
        S(3, "Quarry", "Land", prod_="stone stone", up=[("wood wood coin coin", "rotate")]),
        S(4, "Shallow Mine", "Land", prod_="stone metal", fame=3, effects=[(D, "Discover Mine (84 / 85).")])])
for n in (7, 8):
    card(n, [
        S(1, "Forest", "Land", prod_="wood", up=[("stone stone", "flip")],
          effects=[(A, "Gain {wood}{wood}{wood}, then {rotate}.")]),
        S(2, "Felled Forest", "Land", up=[("stone coin wood coin", "flip"), ("coin", "rotate")]),
        S(3, "Lumberjack", "Building", prod_="wood wood", fame=2),
        S(4, "Sacred Well", "Building", prod_="coin", fame=2, effects=[(D, "Discover Shrine (82 / 83).")])],
        verify=["Felled Forest : la seconde amélioration (1 pièce, flèche verticale) ramène au stage 1 Forest, d'après la géométrie de la carte."])
card(9, [
    S(1, "Headquarters", "Building", prod_="coin", up=[("stone wood stone stone", "rotate")]),
    S(2, "Town Hall", "Building", prod_="sword", fame=3, up=[("wood wood stone stone stone stone", "flip")],
      effects=[(A, "Play 1 land from discard pile.")]),
    S(3, "Keep", "Building", prod_="sword", fame=7,
      up=[("metal wood wood stone stone stone stone stone stone", "rotate")],
      effects=[(A, "Play 1 land or building from discard pile.")]),
    S(4, "Castle", "Building", prod_="sword", fame=12, effects=[(A, "Play 1 card from discard pile.")])])
card(10, [
    S(1, "Trader", "Person", up=[("coin coin coin", "rotate")], effects=[(A, "Spend {coin} to gain {wood}.")]),
    S(2, "Bazaar", "Building", fame=1, up=[("coin coin coin", "flip")],
      effects=[(A, "Spend {coin} to gain {wood}/{stone}.")]),
    S(3, "Market", "Building", fame=3, up=[("coin coin coin coin coin", "rotate")],
      effects=[(A, "Spend {coin} to gain {wood}/{stone}/{metal}.")]),
    S(4, "Festival", "Event", cat="other", prod_="coin/wood/stone/metal", fame=4)])
