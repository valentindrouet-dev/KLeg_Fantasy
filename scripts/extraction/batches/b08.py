from common import *
card(86, [
    S(1, "Dubbing", "Event", cat="other", stay=True,
      effects=[(TF, "End of Round: Add sticker 1 & 5 & 11 to 1 person. Then {flip}.")],
      text="{passive} Stays in play. {triggeredForced} End of Round: Add sticker 1 & 5 & 11 to 1 person. Then {flip}."),
    S(4, "Renovation", "Event", cat="other", stay=True,
      effects=[(TF, "End of Round: Add sticker 2 / 3 and 4 / 6 to 1 building. Then destroy this.")],
      text="{passive} Stays in play. {triggeredForced} End of Round: Add sticker 2 / 3 and 4 / 6 to 1 building. Then destroy this.")])
q = [1, 2, 2, 3, 3, 4, 5, 6, 7]; qf = [1, 3, 6, 10, 14, 20, 27, 35, 45]
card(87, [
    S(1, "Quests", cat="none", perm=True, fameVariable=True,
      boxes=[{"fame": f, "text": "Discard %d person%s." % (c, "" if c == 1 else "s")} for c, f in zip(q, qf)],
      effects=[(T, "Discard the number of persons written for each space to mark 1 {mark} from left to right.")],
      text="This card is permanent. {time} Discard the number of persons written for each space to mark 1 {mark} from left to right. This card is worth the highest marked {fame}.",
      flavor="Build your reputation by sending your adventurers on risky quests.")],
    conf=0.85, verify=[TRACK, "Quests : le coût de chaque case est un nombre de personnes à défausser (1, 2, 2, 3, 3, 4, 5, 6, 7), saisi dans le texte de la case.",
                       "Le verso est le dos de carte générique : aucun stage."])
card(88, [
    S(1, "A Perfect Tower", cat="none", perm=True, fameVariable=True,
      boxes=track("stone", range(1, 11), [3, 6, 10, 15, 22, 30, 38, 48, 60, 75]),
      effects=[(T, "Spend the {stone} below to mark 1 {mark} from left to right.")],
      text="This card is permanent. {time} Spend the {stone} below to mark 1 {mark} from left to right. This card is worth the highest marked {fame}.",
      flavor="But what if the perfect tower would be infinitely tall? So be it!")],
    conf=0.85, verify=[TRACK, "Le verso est le dos de carte générique : aucun stage."])
card(89, [
    S(1, "Deep Pit", "Land", prod_="stone", up=[("wood wood wood wood", "flip"), ("wood stone", "rotate")]),
    S(2, "Town Well", "Land", fame=3, effects=[(P_, "Buildings have +1{coin} production.")]),
    S(3, "Prison", "Building", prod_="sword", fameVariable=True, stay=True,
      boxes=E(3) + [G("sword"), G("sword"), G("coin"), G("coin", "coin"), G("coin", "coin", "coin")],
      effects=[(A, "Mark any 1 {mark} below to discard 1 enemy.")],
      text="{passive} Stays in play. {activated} Mark any 1 {mark} below to discard 1 enemy. {asterisk}Worth 2{fame} per {mark}."),
    S(4, "Pit Settlement", "Building", prod_="wood stone", fame=1, boxes=3,
      effects=[(A, "Mark 1 {mark}. When complete, {rotate}.")])],
    conf=0.85, verify=["Prison : 8 cases lues comme 3 vides, épée, épée, 1 or, 2 or, 3 or (petites icônes) : à vérifier.",
                       "Prison : gloire variable (ruban « * »), 2 par case cochée."])
card(90, [
    S(1, "Jewellery", cat="none", perm=True, fameVariable=True,
      boxes=[dict(b, gain=["tradeGood"] * 5) for b in track("metal", range(1, 11), [1, 2, 3, 5, 7, 10, 14, 20, 28, 40])],
      effects=[(T, "Spend the {metal} below to mark 1 {mark} from left to right and gain 5{tradeGood}.")],
      text="This card is permanent. {time} Spend the {metal} below to mark 1 {mark} from left to right and gain 5{tradeGood}. This card is worth the highest marked {fame}. (5{tradeGood} each)",
      flavor="Beautiful ornaments will tell the world of your riches, and they make for good exports too.")],
    conf=0.85, verify=[TRACK, "Le verso est le dos de carte générique : aucun stage."])
card(91, [
    S(1, "Build an Ark", cat="none", perm=True, boxes=track("wood", [2, 4, 6, 8], None, (10, "{flip}")),
      effects=[(T, "Spend the {wood} below to mark 1 {mark} from left to right. When complete, {flip}.")],
      text="This card is permanent. {time} Spend the {wood} below to mark 1 {mark} from left to right. When complete, {flip}.",
      flavor="I can't explain it, but I feel I should build an unreasonably large ship for future generations..."),
    S(4, "The Ark", "Seafaring,Ship", fame=24, fameVariable=True, boxes=16,
      effects=[(A, "Mark 1 {mark} for every 2 persons you have in play.")],
      text="{activated} Mark 1 {mark} for every 2 persons you have in play. {asterisk}Worth +1{fame} for every {mark}.")],
    conf=0.85, verify=["The Ark : 24 de gloire fixe + 1 par case cochée (16 cases) ; d'après le site, ce côté n'est pas permanent."])
card(92, [
    S(1, "________", "Person", prod_="sword tradeGood",
      effects=[(TF, "1st play: Give her a name!"), (TF, "2nd play: add sticker 5 / 10 here."), (TF, "3rd play: add sticker 6 / 10 here.")]),
    S(4, "________", "Person", stay=True,
      effects=[(TF, "1st play: Give him a name!"), (TF, "2nd play: Add any resource production sticker here (1-6)."), (TF, "3rd play: Add any resource production sticker here (1-6).")],
      text="{passive} Stays in play. {triggeredForced} 1st play: Give him a name! {triggeredForced} 2nd play: Add any resource production sticker here (1-6). {triggeredForced} 3rd play: Add any resource production sticker here (1-6).")],
    conf=0.9, choose=True, verify=["Carte « Stranger » : le nom est vide sur la carte, à donner par le joueur à la première mise en jeu ; il faut compter les mises en jeu (1re, 2e, 3e)."])
card(93, [
    S(1, "Treasure Hunt", "Seafaring", up=[("coin wood metal", "rotate")]),
    S(2, "Pirate Cove", "Seafaring", up=[("metal sword !2_Persons", "flip")],
      effects=[(TF, "End of Turn: Unfortunately discover Backstabber (94).")]),
    S(3, "Treasure Map", "Seafaring", prod_="coin", fame=5, up=[("!2_seafaring", "rotate")]),
    S(4, "Pirate Treasure", "Item,Loot", cat="other", prod_="coin coin", fame=15)],
    conf=0.9, verify=["Coûts non-ressources « 2 Persons » et « 2 seafaring » saisis dans otherCost."])
b = "Spend {sword}{sword}{sword}{sword} to defeat ({destroy})."
card(94, [
    S(1, "Backstabber", "Enemy", fame=-4, defeat=defeat("destroy", 4, b),
      effects=[(TF, "When played, discard 2 persons."), (A, b)]),
    S(4, "Blood Curse", "Event", cat="negative", effects=[(TF, "When you advance, play 2 additional cards.")])],
    conf=0.9, choose=True, verify=["Blood Curse : icône éclair rouge (triggeredForced) sur l'image ; le glossaire du site dit Passive Effect."])
card(95, [
    S(1, "Astronomer", "Person", fameVariable=True, boxes=16, effects=[(A, "Spend {coin}{coin} to mark 1 {mark}.")],
      text="{activated} Spend {coin}{coin} to mark 1 {mark}. {asterisk}Worth 2{fame} per {mark}."),
    S(4, "Astrologist", "Person", prod_="sword", effects=[(A, "Put up to 3 other cards in play on top or bottom of your deck.")])],
    conf=0.9, choose=True, verify=["Astronomer : 16 cases (2 rangées de 8), gloire variable 2 par case cochée."])
card(96, [
    S(1, "Alchemist", "Person", effects=[(A, "Spend {coin}{coin} to rotate this card to any orientation.")]),
    S(2, "Potion of Strength", "Potion,Item", cat="other", effects=[(A, "Reset this card to gain {sword}{sword}{sword}.")]),
    S(3, "Healing Potion", "Potion,Item", cat="other", effects=[(TO, "When discarding a person, you may reset this instead.")]),
    S(4, "Love Potion", "Potion,Item", cat="other", effects=[(A, "Reset this card to gain {tradeGood}{tradeGood}{tradeGood}{tradeGood}{tradeGood}.")])])
card(97, [
    S(1, "Spinning Wheel", "Invention", cat="other", fame=2, up=[("coin coin", "rotate")]),
    S(2, "Silk", "Invention", cat="other", prod_="tradeGood", fame=4, up=[("coin coin coin", "flip")]),
    S(3, "Cloth Export", "Invention", cat="other", prod_="tradeGood tradeGood", fame=6, up=[("coin coin coin coin", "rotate")]),
    S(4, "Fashion", "Invention", cat="other", prod_="tradeGood tradeGood tradeGood", fame=10)])
sea = "Mark 1 {mark} for each seafaring card in play, including this. When complete, %s."
card(98, [
    S(1, "Compass", "Seafaring", fame=2, boxes=E(4) + [G("coin")] * 4, effects=[(A, sea % "{rotate}")]),
    S(2, "Navigation", "Seafaring", fame=8, boxes=[G("coin")] * 4 + [G("tradeGood")] * 4, effects=[(A, sea % "{flip}")]),
    S(3, "Astrolabe", "Seafaring", fame=15, boxes=8, effects=[(A, sea % "{rotate}")]),
    S(4, "Calendar", "Invention", cat="other", fame=15, boxes=4, up=[("", "rotate")],
      effects=[(A, "Mark 1 {mark} to shuffle your discard pile (without Calendar) and put the top 15 cards of it at the bottom of your deck.")])],
    conf=0.85, verify=["Calendar : flèche verticale sans boîte de coût, saisie comme amélioration gratuite vers Astrolabe : à vérifier.",
                       "Cases : Compass = 4 vides puis 4 or ; Navigation = 4 or puis 4 marchandises ; Astrolabe = 8 vides ; Calendar = 4 vides."])
card(99, [
    S(1, "Public Punishment", "Invention", cat="other", prod_="sword", fame=-2, up=[("metal metal", "rotate")]),
    S(2, "Torture Device", "Invention,Item", cat="other", prod_="sword tradeGood", fame=-3, up=[("metal metal metal metal", "flip")]),
    S(3, "Torture Chamber", "Building", prod_="sword sword", fame=-6, up=[("coin " * 6, "rotate")]),
    S(4, "Post-Barbaric", "State", cat="other", fame=15)])
