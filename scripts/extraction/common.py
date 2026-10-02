from kl import *
A, P_, D, TF, TO, T, O = "activated", "passive", "destroy", "triggeredForced", "triggeredOptional", "time", "oneTime"
OT = {"oneTime": True}
PARCH = "Instructions de parchemin : classées triggeredForced (à appliquer à la découverte, puis détruire la carte) ; le site ne donne pas de type d'effet."
G = lambda *r: {"gain": list(r)}
def defeat(kind, n, text): return {"kind": kind, "cost": ["sword"] * n, "text": text}
def young_forest(id_=3):
    return S(id_, "Young Forest", "Land", fame=1, boxes=["asterisk", None, "asterisk", None, "asterisk"],
             effects=[(T, "Mark 1 {mark} from top to bottom. When you mark a {asterisk}, add sticker 2 as production here.")])
def ashlands(id_=4): return S(id_, "Ashlands", "Land", fame=-2, up=[("coin coin", "rotate")])
def enemy_soldier(id_=4):
    t = "Spend {sword}{sword} to defeat ({destroy})."
    return S(id_, "Enemy Soldier", "Enemy", fame=-2, stay=True,
             effects=[(TF, "When played, blocks 1 building / land in play."), (TF, "End of Round: Destroy the blocked card, if any."), (A, t)],
             text="{triggeredForced} When played, blocks 1 building / land in play. {passive} Stays in play. {triggeredForced} End of Round: Destroy the blocked card, if any. {activated} " + t,
             defeat=defeat("destroy", 2, t))
def distant_mountain(n, **kw):
    card(n, [
        S(1, "Distant Mountain", "Land", prod_="coin", up=[("coin coin", "rotate")]),
        S(2, "Rocky Area", "Land", prod_="stone", up=[("wood coin wood coin", "flip")],
          effects=[(A, "Spend {coin} to gain {stone}{stone}.")]),
        S(3, "Quarry", "Land", prod_="stone stone", up=[("wood wood coin coin", "rotate")]),
        S(4, "Shallow Mine", "Land", prod_="stone metal", fame=3, effects=[(D, "Discover Mine (84 / 85).")])], **kw)
def forest(n, **kw):
    card(n, [
        S(1, "Forest", "Land", prod_="wood", up=[("stone stone", "flip")],
          effects=[(A, "Gain {wood}{wood}{wood}, then {rotate}.")]),
        S(2, "Felled Forest", "Land", up=[("stone coin wood coin", "flip"), ("coin", "rotate")]),
        S(3, "Lumberjack", "Building", prod_="wood wood", fame=2),
        S(4, "Sacred Well", "Building", prod_="coin", fame=2, effects=[(D, "Discover Shrine (82 / 83).")])],
        verify=["Felled Forest : la seconde amélioration (1 pièce, flèche verticale) ramène au stage 1 Forest, d'après la géométrie de la carte."], **kw)
def camp(n):
    card(n, [
        S(1, "Camp", "Land", up=[("coin wood metal", "rotate")]),
        S(2, "Training Grounds", "Land", fame=1, up=[("metal metal", "flip")], effects=[(A, "Spend {coin} to gain {sword}.")]),
        S(3, "Sir ________", "Person,Knight", prod_="sword sword", fame=3)],
        conf=0.9, o2s={"front-0": 1, "front-180": 2, "back-0": None, "back-180": 3},
        verify=["Le verso ne porte qu'un stage (Sir ________), imprimé tête en bas sur l'image du site : stage 3 placé en back-180, cohérent avec la flèche horizontale de Training Grounds.",
                "Sir ________ : le nom est à compléter par le joueur (champ libre), sans effet de règle."])
def squire(id_=3): return S(id_, "Squire", "Person", prod_="sword", fame=3, effects=[(D, "Gain {sword}{sword}{sword}.")])
def impressed_boy(id_=4): return S(id_, "Impressed Boy", "Person", up=[("metal sword", "rotate")], effects=[(D, "Gain {sword}{sword}.")])
def wall(id_=4): return S(id_, "Wall", "Building", prod_="sword", fame=3, stay=True)
def track(res, costs, fames=None, last=None):
    fames = fames or [None] * len(costs)
    b = [dict({"cost": [res] * c}, **({"fame": f} if f is not None else {})) for c, f in zip(costs, fames)]
    if last: b.append({"cost": [res] * last[0], "text": last[1]})
    return b
TRACK = "Carte de piste : la gloire vaut la plus haute case cochée (fameVariable) ; coûts et gloire de chaque case lus sur l'image."
E = lambda n=1: [None] * n
def royal_visit(n, **kw):
    card(n, [
        S(1, "Royal Visit", "Event", cat="other", fame=2,
          effects=[(A, "Cross out 1 resource icon in an upgrade cost on 1 card in play.")]),
        S(4, "Inquisitor", "Person", prod_="coin", effects=[(D, "Destroy 1 {negative} card in play.")])],
        conf=0.9, choose=True, **kw)
BACK = "Le verso est le dos de carte générique : aucun stage."
FOUR = "Flèches rouges sur les deux faces : à la découverte, choix entre le recto (stage 1) et le verso (stage 4)."
def trader(n):
    card(n, [
        S(1, "Trader", "Person", up=[("coin coin coin", "rotate")], effects=[(A, "Spend {coin} to gain {wood}.")]),
        S(2, "Bazaar", "Building", fame=1, up=[("coin coin coin", "flip")], effects=[(A, "Spend {coin} to gain {wood}/{stone}.")]),
        S(3, "Market", "Building", fame=3, up=[("coin coin coin coin coin", "rotate")], effects=[(A, "Spend {coin} to gain {wood}/{stone}/{metal}.")]),
        S(4, "Festival", "Event", cat="other", prod_="coin/wood/stone/metal", fame=4)])
