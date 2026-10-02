from common import *
def skilled(n, back, kind):
    t = "Spend {sword}{sword}{sword} to defeat ({destroy}) and gain any 3 resources."
    card(n, [
        S(1, "Skilled Bandit", "Enemy", fame=-5, defeat=defeat("destroy", 3, t),
          effects=[(TF, "When played, blocks 3 cards with production."), (A, t)],
          text="{triggeredForced} When played, blocks 3 cards with production. {activated} " + t + " (Can be {flip} by a Missionary)"),
        S(4, back, "Person", effects=[(A, "Choose a %s in play. Gain its production as resources." % kind)])],
        conf=0.9, verify=["Skilled Bandit : la mention « (Can be {flip} by a Missionary) » n'est pas un effet de cette carte ; elle est gardée dans le texte seulement."])
skilled(60, "Worker", "building")
skilled(64, "Field Worker", "land")
dp = "Spend {sword}{sword}{sword}{sword}{sword} to defeat ({flip})."
card(61, [
    S(1, "Dark Prince", "Enemy", fame=-7, defeat=defeat("turn", 5, dp),
      effects=[(P_, "You may not advance, upgrade, or use {time} effects."), (A, dp)]),
    squire(), impressed_boy()],
    conf=0.9, verify=["Dark Prince : 5 épées comptées dans le coût de défaite."])
camp(62)
card(63, [
    S(1, "Far Fields", "Land", prod_="coin", up=[("stone stone stone stone", "flip"), ("wood stone coin wood stone coin", "rotate")]),
    S(2, "Inn", "Building", prod_="coin coin", fame=2, up=[("coin " * 6, "flip")]),
    S(3, "Innkeeper", "Person", fame=3, effects=[(A, "Discard another person to gain any 2 resources.")]),
    S(4, "Wall", "Building", prod_="sword", fame=3, stay=True)])
card(65, [
    S(1, "Tornado", "Event", cat="negative", stay=True,
      effects=[(TF, "End of Round: Destroy any 3 friendly non-permanent cards in your kingdom. Then {flip}.")],
      text="{passive} Stays in play. {triggeredForced} End of Round: Destroy any 3 friendly non-permanent cards in your kingdom. Then {flip}."),
    S(4, "Flooding", "Event", cat="negative", stay=True,
      effects=[(TF, "Blocks all buildings (max 5 blocked buildings here)."),
               (TF, "End of Round: Destroy this and 1 blocked building or any 2 other friendly non-permanent cards.")],
      text="{passive} Stays in play. {triggeredForced} Blocks all buildings (max 5 blocked buildings here). {triggeredForced} End of Round: Destroy this and 1 blocked building or any 2 other friendly non-permanent cards.")])
card(66, [
    S(1, "Young Princess", "Person", fame=2, up=[("!2_Persons !2_Lands !2_Buildings", "flip")],
      effects=[(TF, "End of Turn: discard 2 persons or {rotate}.")]),
    S(2, "Spoiled Princess", "Person", up=[("!2_Persons", "rotate")],
      effects=[(TF, "When played, discard 2 friendly cards in play.")]),
    S(4, "Educated Princess", "Person,Lady", fame=8, effects=[(A, "Gain any 1 resource.")])],
    conf=0.9, verify=["Coûts d'amélioration non-ressources (« 2 Persons 2 Lands 2 Buildings », « 2 Persons ») saisis dans otherCost ; règle exacte à confirmer."])
card(67, [
    S(1, "Sickness", "Event", cat="negative", fame=-8, up=[("tradeGood " * 7, "flip"), ("coin", "rotate")],
      effects=[(TF, "When played, discard the next 2 cards from your deck.")]),
    S(2, "Crippled", "State", cat="other", fame=-2, perm=True, text="This card is permanent."),
    S(4, "Feast", "Event", cat="other", fame=2, effects=[(A, "Gain any 1 resource.")])],
    conf=0.9, verify=["Sickness : 7 marchandises comptées dans le coût de l'amélioration vers Feast.",
                      "Crippled : bandeau rose (category=other), mot-clé « State », permanente."])
card(68, [
    S(1, "STOP!", cat="none",
      effects=[(TF, "Discover 2 cards as normal (cards 69-70). This is your last round. When this round is over, count your fame ({fame}) and write it in the first {fame} on the side of the box.")],
      text="STOP! Discover 2 cards as normal (cards 69-70). This is your last round. When this round is over, count your fame ({fame}) and write it in the first {fame} on the side of the box. It's time to brag to your friends! Can they beat your score and make a better kingdom? I doubt it! When the round is over, {flip}."),
    S(4, "", cat="none",
      text="To count your fame, look through all your cards, including your permanent cards. Sum up all {fame} on their active stages. Note that some cards, especially the Goal cards, might require some additional calculations to determine their fame {fame}. Are you ready to continue your adventure? This game includes built-in expansions that let you play more rounds, but they will not give new cards. Read the section about built-in expansions on the rule sheet. If you want brand new cards, there are other expansions to explore (visit www.fryxgames.se). Happy gaming!")],
    conf=0.9, parchment=True, isFinalRoundMarker=True,  # décision du 2026-10-02 (docs/RULES_DECISIONS.md)
    verify=[PARCH])
card(69, [
    S(1, "Finishing Touch", "Event", cat="other", effects=[(D, "Add sticker 6 and 10 to 1 friendly card in play.")]),
    S(4, "Banquet", "Event", cat="other", effects=[(D, "Gain any 4 resources.")])], choose=True)
card(70, [
    S(1, "Royal Visit", "Event", cat="other", fame=2,
      effects=[(A, "Cross out 1 resource icon in an upgrade cost on 1 card in play.")]),
    S(4, "Inquisitor", "Person", prod_="coin", effects=[(D, "Destroy 1 {negative} card in play.")])],
    conf=0.9, choose=True)
distant_mountain(71)
forest(72)
