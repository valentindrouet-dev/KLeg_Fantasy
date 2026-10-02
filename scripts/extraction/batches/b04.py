from kl import *
A, P_, D, TF, TO, T = "activated", "passive", "destroy", "triggeredForced", "triggeredOptional", "time"
PARCH = "Instructions de parchemin : classées triggeredForced (à appliquer à la découverte, puis détruire la carte) ; le site ne donne pas de type d'effet."
GOAL = "Carte objectif : bandeau jaune mais pas une personne (category=goal, mot-clé Goal) ; gloire calculée par le texte (fameVariable)."
OT = {"oneTime": True}
card(36, [
    S(1, "Mercenary", "Person", up=[("coin metal coin coin", "flip")], boxes=[{"gain": ["sword"]}] * 8,
      effects=[(A, "Spend {coin}{coin} to mark 1-2 {mark}.")]),
    S(4, "Sir ________", "Person,Knight", prod_="sword", fame=3,
      effects=[(T, "Spend {metal}{metal}{metal} to add sticker 5 here.", OT),
               (T, "Spend {metal}{metal}{metal}{metal} to add sticker 5 here.", OT)])],
    conf=0.9, verify=["Sir ________ : le nom est à compléter par le joueur (champ libre), sans effet de règle.",
                      "Mercenary : 8 cases contenant chacune une épée, comptées sur l'image."])
card(37, [
    S(1, "STOP!", cat="none",
      effects=[(TF, "Discover 5 cards this round, instead of 2 (cards 38-42). The first 3 are goal cards. For each card, you need to choose one of its sides now, it cannot be changed later.")],
      text="STOP! Discover 5 cards this round, instead of 2 (cards 38-42). The first 3 are goal cards. For each card, you need to choose one of its sides now, it cannot be changed later.",
      flavor="It's time to set up some goals for your kingdom, something to strive for.")],
    conf=0.9, parchment=True, verify=[PARCH])
def goal(n, a, ta, b, tb):
    card(n, [S(1, a, "Goal", cat="goal", perm=True, fameVariable=True, text=ta),
             S(4, b, "Goal", cat="goal", perm=True, fameVariable=True, text=tb)], conf=0.9, choose=True, verify=[GOAL])
goal(38, "Strength in Numbers", "{asterisk}Worth 2{fame} per person.",
     "Military Dominance", "{asterisk}Worth 2{fame} per production of {sword}.")
goal(39, "Expanding Borders", "{asterisk}You want 75 or more cards in your kingdom (not counting permanent cards). This is worth -2{fame} for each card missing from 75.",
     "Maximizer", "{asterisk}Worth -1{fame} per card with exactly 0{fame} (excluding permanent cards).")
goal(40, "Loyalty", "{asterisk}Worth 25{fame} if there is no enemy in your kingdom.",
     "Trader", "{asterisk}Worth 25{fame} if your production of {tradeGood} is 10 or more.")
G = lambda *r: {"gain": list(r)}
card(41, [
    S(1, "Jester", "Person", stay=True,
      boxes=[G("coin", "coin")] * 3 + [G("coin", "wood")] * 3 + [G("tradeGood", "tradeGood")] * 2,
      effects=[(A, "Discard the top card of your deck."), (A, "Mark 1 {mark}.")],
      text="{passive} Stays in play. {activated} Discard the top card of your deck. {activated} Mark 1 {mark}."),
    S(4, "Merchant", "Person", boxes=[G(r) for r in ["coin", "coin", "wood", "wood", "stone", "stone", "metal", "metal"]] * 3,
      effects=[(A, "Mark 1-2 {mark}.")])],
    conf=0.9, choose=True,
    verify=["Jester : 8 cases à deux icônes (3 × or+or, 3 × or+bois, 2 × marchandise+marchandise), lues sur l'image.",
            "Merchant : 24 cases en 3 rangées identiques (or, or, bois, bois, pierre, pierre, métal, métal)."])
card(42, [
    S(1, "Field Worker", "Person", effects=[(A, "Choose a land in play. Gain its production as resources.")]),
    S(4, "Storage", "Building", fame=1, stay=True,
      effects=[(TO, "End of Turn: Discard to make another card stay in play.")],
      text="{passive} Stays in play. {triggeredOptional} End of Turn: Discard to make another card stay in play.")], choose=True)
card(43, [
    S(1, "Mason", "Person", prod_="stone", up=[("coin stone coin stone", "flip")],
      effects=[(A, "Spend {coin}{coin} to discover a building project (88 / 89).")]),
    S(3, "Stone Street", "Land", prod_="coin", fame=7,
      effects=[(T, "Look at cards 111 and 112. Destroy 1 of them and discover the other.")]),
    S(4, "Brick Road", "Land", prod_="coin", fame=3, up=[("stone stone stone stone", "rotate")],
      effects=[(T, "Look at cards 109 and 110. Destroy 1 of them and discover the other.")])])
card(44, [
    S(1, "Thunderstorm", "Event", cat="negative",
      effects=[(TF, "When played, discard the next 3 cards of your deck, then {flip}.")]),
    S(4, "Rain", "Event", cat="negative",
      effects=[(P_, "Your lands have +{coin}{coin} production."), (P_, "You may not advance."), (TF, "End of Turn: {flip}.")])])
card(45, [
    S(1, "Dark Knight", "Enemy", fame=-3,
      effects=[(P_, "You may not advance, upgrade, or use {time} effects."),
               (A, "Spend {sword}{sword}{sword} to defeat ({flip}).")],
      defeat={"kind": "turn", "cost": ["sword", "sword", "sword"], "text": "Spend {sword}{sword}{sword} to defeat ({flip})."}),
    S(3, "Squire", "Person", prod_="sword", fame=3, effects=[(D, "Gain {sword}{sword}{sword}.")]),
    S(4, "Impressed Boy", "Person", up=[("metal sword", "rotate")], effects=[(D, "Gain {sword}{sword}.")])])
card(46, [
    S(1, "Camp", "Land", up=[("coin wood metal", "rotate")]),
    S(2, "Training Grounds", "Land", fame=1, up=[("metal metal", "flip")], effects=[(A, "Spend {coin} to gain {sword}.")]),
    S(3, "Sir ________", "Person,Knight", prod_="sword sword", fame=3)],
    conf=0.9, o2s={"front-0": 1, "front-180": 2, "back-0": None, "back-180": 3},
    verify=["Le verso ne porte qu'un stage (Sir ________), imprimé tête en bas sur l'image du site : stage 3 placé en back-180, cohérent avec la flèche horizontale de Training Grounds.",
            "Sir ________ : le nom est à compléter par le joueur (champ libre), sans effet de règle."])
card(47, [
    S(1, "STOP!", cat="none",
      effects=[(TF, "This round, instead of discovering 2 cards, look at the next 4 cards (cards 48-51). Discover 2 of them and destroy the other 2.")],
      text="STOP! This round, instead of discovering 2 cards, look at the next 4 cards (cards 48-51). Discover 2 of them and destroy the other 2.",
      flavor="Even more immigrants are longing for a place to follow their dreams, and your kingdom seems to deliver on that promise.")],
    conf=0.9, parchment=True, verify=[PARCH])
