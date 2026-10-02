from kl import *
A, P_, D, TF, TO, T = "activated", "passive", "destroy", "triggeredForced", "triggeredOptional", "time"
PARCH = "Instructions de parchemin : classées triggeredForced (à appliquer à la découverte, puis détruire la carte) ; le site ne donne pas de type d'effet."
card(0, [
    S(1, "Welcome", cat="none",
      text="WELCOME to Kingdom Legacy - Feudal Kingdom. Make sure to read the rules before opening this pack of cards, or scan the QR code below to watch a tutorial. Memorize the golden rules (see {flip})! The orientation of the cards in this game is important, so do not shuffle, rotate, or flip the cards except when instructed by the rules. The best of luck building your kingdom!")],
    conf=0.9, parchment=True,
    verify=["Carte de couverture, jamais découverte en jeu : isParchment=true par analogie visuelle (fond parchemin), à confirmer.",
            "Le site nomme le stage 1 « STOP! » (erreur probable du site) : nom repris de l'image (WELCOME).",
            "Le verso (Golden Rules) n'a aucun stage sur le site : il n'est pas modélisé comme stage."])
card(23, [
    S(1, "STOP!", cat="none",
      effects=[(TF, "Now that you have got the hang of the game, you may reset to start again if you like to give it your best shot. If you continue, you will discover 4 cards, cards 24-27. Look at them now and THEN decide if you want to restart or continue.")],
      text="STOP! Now that you have got the hang of the game, you may reset to start again if you like to give it your best shot. If you continue, you will discover 4 cards, cards 24-27. Look at them now and THEN decide if you want to restart or continue. After this card comes the legacy part of the game, where some cards will permanently change over the course of the game. You will not be able to reset the game once you continue down this road. Rule clarifications on the back ({flip})."),
    S(4, "", cat="none",
      text="Cards 25, 26, and 27 are permanent cards, meaning they are never shuffled into your deck and cannot be discarded. They are always visible and active, but are not counted as \"in play\". The Army and Treasury are track cards. They let you spend your turn ({time}) and resources ({sword}/{coin}) to gain fame {fame}. Export is a tally card. It doesn't end your turn ({passive}) and lets you spend trade goods ({tradeGood}) to gain stickers, new cards, and other cool effects. You will not be able to complete all tracks before the game ends. Try to get as far as possible! We recommend reading through the golden rules again to avoid mistakes.")],
    conf=0.9, parchment=True, verify=[PARCH])
card(24, [
    S(1, "Fertile Soil / Efficiency", cat="none",
      effects=[(TF, "Fertile Soil: Add sticker 1 ({coin}) as production to a land."),
               (TF, "Efficiency: Choose 1 building and boost its production (add a resource sticker to it to make it produce 1 more of a resource it already produces. Resource stickers are numbered 1-6 on the sticker sheet).")],
      text="Fertile Soil: Add sticker 1 ({coin}) as production to a land. Efficiency: Choose 1 building and boost its production (add a resource sticker to it to make it produce 1 more of a resource it already produces. Resource stickers are numbered 1-6 on the sticker sheet). (Reminder: When discovering a parchment card like this, follow all its instructions, then destroy this.)",
      flavor="This land seems to grow anything you put into the ground. / You're getting the hang of this!")],
    conf=0.9, parchment=True, verify=[PARCH])
def track(res, costs, fames, last=None):
    b = [{"cost": [res] * c, "fame": f} for c, f in zip(costs, fames)]
    if last: b.append({"cost": [res] * last[0], "text": last[1]})
    return b
TRACK = "Carte de piste : la gloire vaut la plus haute case cochée (fameVariable) ; coûts et gloire de chaque case lus sur l'image."
card(25, [
    S(1, "Army", cat="none", perm=True, fameVariable=True,
      boxes=track("sword", range(1, 10), [1, 4, 7, 10, 14, 19, 25, 32, 40], (10, "Discover Vassal State (135) and {flip}.")),
      effects=[(T, "Spend the {sword} below to improve your army: mark 1 {mark} from left to right. When complete, discover Vassal State (135) and {flip}.")],
      text="This card is permanent. {time} Spend the {sword} below to improve your army: mark 1 {mark} from left to right. When complete, discover Vassal State (135) and {flip}. This card is worth the highest marked {fame}.",
      flavor="In order to conquer new territory, you need to train an army."),
    S(4, "Grand Army", cat="none", perm=True, fame=50, fameVariable=True,
      boxes=track("sword", [10, 10, 12, 12, 15], [10, 20, 30, 40, 50]),
      effects=[(T, "Spend the {sword} below to improve your army: mark 1 {mark} from left to right.")],
      text="This card is permanent. {time} Spend the {sword} below to improve your army: mark 1 {mark} from left to right. This card is worth 50{fame} + the highest marked {fame}.",
      flavor="Oh, I won't settle for a country, give me a continent!")],
    conf=0.85, verify=[TRACK])
card(26, [
    S(1, "Treasury", cat="none", perm=True, fameVariable=True,
      boxes=track("coin", range(1, 12), [1, 2, 3, 5, 7, 10, 14, 19, 25, 32, 40], (12, "{flip}")),
      effects=[(T, "Spend the {coin} below to fill up your treasury: mark 1 {mark} from left to right.")],
      text="This card is permanent. {time} Spend the {coin} below to fill up your treasury: mark 1 {mark} from left to right. This card is worth the highest marked {fame}.",
      flavor="Store up those riches, you never know when you might need them!"),
    S(4, "Extended Treasury", cat="none", perm=True, fame=50, fameVariable=True,
      boxes=track("coin", [13, 14, 15, 16, 17], [10, 20, 30, 40, 50]),
      effects=[(T, "Spend the {coin} below to fill up your treasury: mark 1 {mark} from left to right.")],
      text="This card is permanent. {time} Spend the {coin} below to fill up your treasury: mark 1 {mark} from left to right. This card is worth 50{fame} + the highest marked {fame}.",
      flavor="I want to be unreasonably rich and put King Midas to shame.")],
    conf=0.85, verify=[TRACK])
def tally(rows): return [{"threshold": t, "text": x} for t, x in rows]
card(27, [
    S(1, "Export", cat="none", perm=True,
      boxes=tally([(10, "Sticker 1 / 2 / 3 on 1 land."), (20, "Sticker 7 on 1 person."), (30, "Discover Dubbing (86)."),
                   (40, "Sticker 4 / 5 / 6 on 1 building."), (55, "Sticker 2 / 3 / 4 / 5 on 1 friendly card."),
                   (75, "Sticker 10 on any card."), (100, "{flip}")]),
      effects=[(P_, "Spend {tradeGood} here and keep track of how much you have spent."),
               (TO, "Between rounds, you may use effects you have reached enough {tradeGood} for (mark {mark}).")],
      text="This card is permanent. {passive} Spend {tradeGood} here and keep track of how much you have spent. Between rounds, you may use effects you have reached enough {tradeGood} for (mark {mark}): 10: Sticker 1 / 2 / 3 on 1 land. 20: Sticker 7 on 1 person. 30: Discover Dubbing (86). 40: Sticker 4 / 5 / 6 on 1 building. 55: Sticker 2 / 3 / 4 / 5 on 1 friendly card. 75: Sticker 10 on any card. 100: {flip}.",
      flavor="Make yourself invaluable for your neighbours, it will surely pay off."),
    S(4, "Mass Export", cat="none", perm=True, fame=25,
      boxes=tally([(25, "Sticker 8 on 2 different lands."), (50, "Sticker 10 on 1 person."), (75, "Discover Royal Visit (107)."),
                   (100, "Sticker 10 on 1 building."), (150, "{mark} 1 other permanent card, gaining any effects."),
                   (200, "{mark} all other permanent cards you want."), (250, "Discover Trade Relations (117).")]),
      effects=[(P_, "Spend {tradeGood} here and keep track of how much you have spent below."),
               (TO, "Between rounds, you may use (and {mark}) effects below you have reached enough {tradeGood} for.")],
      text="This card is permanent. {passive} Spend {tradeGood} here and keep track of how much you have spent below. Between rounds, you may use (and {mark}) effects below you have reached enough {tradeGood} for: 25: Sticker 8 on 2 different lands. 50: Sticker 10 on 1 person. 75: Discover Royal Visit (107). 100: Sticker 10 on 1 building. 150: {mark} 1 other permanent card, gaining any effects. 200: {mark} all other permanent cards you want. 250: Discover Trade Relations (117).")],
    conf=0.85,
    verify=["Carte de compte : le total de marchandises dépensées est un compteur libre (lignes de pointage), non modélisé par des cases ; les cases portent les seuils.",
            "Les effets « Between rounds » sont classés triggeredOptional d'après le texte (« you may ») ; le site n'indique que Passive Effect.",
            "Mass Export cite « Royal Visit (107) » alors que la carte 70 s'appelle aussi Royal Visit : à recouper avec la carte 107."])
card(28, [
    S(1, "Volcanic Eruption", "Event", cat="negative",
      effects=[(TF, "While this is in play, destroy the next land you play. When you do, {flip}.")]),
    S(3, "Young Forest", "Land", fame=1, boxes=["asterisk", None, "asterisk", None, "asterisk"],
      effects=[(T, "Mark 1 {mark} from top to bottom. When you mark a {asterisk}, add sticker 2 as production here.")]),
    S(4, "Ashlands", "Land", fame=-2, up=[("coin coin", "rotate")])],
    conf=0.9, verify=["Young Forest : 5 cases de haut en bas, dont 3 avec astérisque (1re, 3e, 5e), lues sur l'image."])
card(29, [
    S(1, "Opportunist", "Person", prod_="coin", up=[("", "flip"), ("", "rotate")]),
    S(2, "Recruit", "Person", prod_="sword", up=[("", "flip"), ("", "rotate")]),
    S(3, "Pretend Noble", "Person", fame=4, up=[("", "flip"), ("", "rotate")],
      effects=[(A, "Reset to add any resource sticker as production on any stage of this card without stickers.")]),
    S(4, "Labourer", "Person", prod_="stone", up=[("", "flip"), ("", "rotate")])],
    conf=0.9, verify=["La description du site place Pretend Noble au stage 4, mais ses mots-clés et l'image le placent au stage 3 (verso, tête en bas) : stage 3 retenu.",
                      "Les 8 améliorations sont gratuites (boîtes sans icône) ; les cibles sont déduites des flèches."])
card(30, [
    S(1, "STOP!", cat="none",
      effects=[(TF, "This round, instead of discovering the next 2 cards, look at the 4 next cards of the box (cards 31-34). Choose 2 of them to discover and destroy the other 2.")],
      text="STOP! This round, instead of discovering the next 2 cards, look at the 4 next cards of the box (cards 31-34). Choose 2 of them to discover and destroy the other 2.",
      flavor="With your kingdom growing and flourishing, many are coming here to pursue their dreams.")],
    conf=0.9, parchment=True, verify=[PARCH])
card(31, [
    S(1, "Entrepreneur", "Person", prod_="tradeGood", up=[("coin wood wood wood", "rotate")],
      effects=[(T, "Discover School (118).")]),
    S(2, "Hotel", "Building", prod_="coin tradeGood", fame=2, up=[("coin wood stone", "flip")],
      effects=[(A, "Gain {coin} per person in play.")]),
    S(3, "Cozy Pub", "Building", prod_="tradeGood tradeGood", fame=2,
      up=[("tradeGood wood coin tradeGood wood coin", "rotate")],
      effects=[(A, "Discard 1 person to discover Stranger (92).")]),
    S(4, "Tavern", "Building", prod_="tradeGood tradeGood coin coin", fame=4, effects=[(A, "Discover Quests (87).")])])
card(32, [
    S(1, "Scientist", "Person", up=[("wood metal stone stone", "flip")],
      effects=[(P_, "All persons, including Scientist, have +1{coin} production.")]),
    S(3, "Lab", "Building", prod_="tradeGood tradeGood coin", fame=10, effects=[(T, "Discover Alchemist (96).")]),
    S(4, "Observatory", "Building", prod_="tradeGood coin", fame=5, up=[("metal metal stone stone coin", "rotate")],
      effects=[(T, "Discover Astronomer (95).")])])
card(33, [
    S(1, "Engineer", "Person", up=[("wood metal wood metal", "flip")],
      effects=[(A, "Destroy one of the following cards in play to discover an improved version of it; Lumberjack - discover card 100 Food Barns - discover card 101 Fishing Boat - discover card 102")]),
    S(4, "Trebuchet", "Building", prod_="sword", fame=1,
      effects=[(D, "Defeat an enemy in play, discard pile, or permanent. Then mark the next {mark} on The Army / Grand Army.")])])
card(34, [
    S(1, "Inventor", "Person", fameVariable=True, boxes=3, up=[("coin coin coin coin", "flip")],
      text="{asterisk}Worth 5{fame} per {mark}."),
    S(4, "Inspired Inventor", "Person", fameVariable=True,
      effects=[(A, "Reset and mark 1 {mark} on that side if possible. Then discover an invention (97 / 98 / 99) or gain any 1 resource for each {mark}.")],
      text="{activated} Reset and mark 1 {mark} on that side if possible. Then discover an invention (97 / 98 / 99) or gain any 1 resource for each {mark}. {asterisk}Worth 5{fame} for each {mark} on the other side.")],
    conf=0.9, verify=["Gloire variable (ruban « * ») : 5 par case cochée du recto ; fame=0 et fameVariable=true."])
card(35, [
    S(1, "Distant Mountain", "Land", prod_="coin", up=[("coin coin", "rotate")]),
    S(2, "Rocky Area", "Land", prod_="stone", up=[("wood coin wood coin", "flip")],
      effects=[(A, "Spend {coin} to gain {stone}{stone}.")]),
    S(3, "Quarry", "Land", prod_="stone stone", up=[("wood wood coin coin", "rotate")]),
    S(4, "Shallow Mine", "Land", prod_="stone metal", fame=3, effects=[(D, "Discover Mine (84 / 85).")])])
