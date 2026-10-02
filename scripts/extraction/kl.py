# Aide à la saisie des fiches (extraction visuelle). Écrit data/cards/FeudalKingdom/{n}.json.
# Mode d'emploi : scripts/extraction/README.md
import json, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EXP = "FeudalKingdom"
KEYS = ["front-0", "front-180", "back-0", "back-180"]
CAT = {"Land": "land", "Building": "building", "Person": "person", "Livestock": "livestock",
       "Seafaring": "seafaring", "Enemy": "negative"}
SITE_TYPES = {"Activated Effect": "activated", "Passive Effect": "passive", "Destroy Effect": "destroy",
              "Triggered Optional Effect": "triggeredOptional", "Forced Triggered Effect": "triggeredForced",
              "Time Effect": "time", "One-time Effect": "oneTime"}
def raw(n): return json.load(open(f"{ROOT}/data/raw/{EXP}/{n}.json"))
def strip(t): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t)).strip()
def show(a, b):
    for n in range(a, b + 1):
        r = raw(n)
        print(f"#{n} recto{r['sides']['front']} verso{r['sides']['back']} variant={r['variant']}")
        if r["description"]: print("   DESC:", strip(r["description"]))
        for s in r["stages"]:
            print(f"   st{s['stage']} {'' if s['namePlaceholder'] else repr(s['name'])} kw={[k['name'] for k in s['keywords']]}")
            if s["description"]: print("      help:", strip(s["description"]))
def icons(s): return s.split()
def prod(p):
    if not p: return []
    groups = p if isinstance(p, list) else [p]
    return [{"id": f"p{i+1}", "options": [icons(o) for o in g.split("/")]} for i, g in enumerate(groups)]
def S(id, name, kw="", cat=None, prod_="", up=(), fame=0, effects=(), text=None, boxes=0, stay=False,
      perm=False, **extra):
    return dict(id=id, name=name, kw=[k for k in kw.split(",") if k] if isinstance(kw, str) else kw, cat=cat,
                prod=prod_, up=list(up), fame=fame, effects=list(effects), text=text, boxes=boxes, stay=stay,
                perm=perm, extra=extra)
def card(n, stages, conf=0.95, verify=(), **kw):
    r = raw(n)
    f, b = r["sides"]["front"], r["sides"]["back"]
    o2s = kw.pop("o2s", None) or {"front-0": f[0] if f else None, "front-180": f[1] if len(f) > 1 else None,
           "back-0": b[0] if b else None, "back-180": b[1] if len(b) > 1 else None}
    s2o = {v: k for k, v in o2s.items() if v}
    verify = list(verify); warn = []
    out = {}
    for st in stages:
        rs = next((x for x in r["stages"] if x["stage"] == st["id"]), None)
        if rs is None: warn.append(f"stage {st['id']} absent du site"); rs = {"keywords": [], "description": ""}
        cat = st["cat"] or next((CAT[k] for k in st["kw"] if k in CAT), None)
        if cat is None: raise SystemExit(f"#{n} st{st['id']}: catégorie à préciser")
        ups = []
        for i, u in enumerate(st["up"]):
            cost, arrow = u[0], u[1]
            side, rot = s2o[st["id"]].split("-")
            tgt = f"{side}-{'180' if rot == '0' else '0'}" if arrow == "rotate" else f"{'back' if side == 'front' else 'front'}-{rot}"
            to = u[2] if len(u) > 2 else o2s[tgt]
            if to is None: raise SystemExit(f"#{n} st{st['id']}: cible d'amélioration introuvable")
            d = {"id": f"u{i+1}", "cost": [c for c in icons(cost) if not c.startswith("!")], "arrow": arrow, "toStage": to}
            other = " ".join(c[1:].replace("_", " ") for c in icons(cost) if c.startswith("!"))
            if other: d["otherCost"] = other
            ups.append(d)
        effs = [dict({"id": f"e{i+1}", "type": e[0], "text": e[1]}, **(e[2] if len(e) > 2 else {})) for i, e in enumerate(st["effects"])]
        boxes = st["boxes"]
        if isinstance(boxes, int): boxes = [None] * boxes
        cbs = [dict({"id": f"c{i+1}"}, **(ic if isinstance(ic, dict) else {"icon": ic} if ic else {})) for i, ic in enumerate(boxes)]
        text = st["text"]
        if text is None:
            parts = [f"{{{e['type']}}} {e['text']}" + (" {oneTime}" if e.get("oneTime") else "") for e in effs]
            if st["stay"]: parts.append("{passive} Stays in play.")
            text = " ".join(parts)
        sk = [k["name"] for k in rs["keywords"]]
        o = {"id": st["id"], "name": st["name"], "keywords": st["kw"], "category": cat, "negative": cat == "negative",
             "permanent": st["perm"], "fame": st["fame"], "production": prod(st["prod"]), "upgrades": ups,
             "effects": effs, "checkboxes": cbs, "staysInPlay": st["stay"]}
        o.update(st["extra"])
        o.update({"text": text, "siteKeywords": sk})
        if rs["description"]: o["helpText"] = rs["description"]
        out[str(st["id"])] = o
        # Recoupement site / lecture visuelle
        types = {e["type"] for e in effs} | ({"oneTime"} if any(e.get("oneTime") for e in effs) else set())
        for k in sk:
            if k in SITE_TYPES and SITE_TYPES[k] not in types: warn.append(f"st{st['id']}: site dit {k}, pas d'effet de ce type")
        for t in types:
            if t not in {SITE_TYPES.get(k) for k in sk}: warn.append(f"st{st['id']}: effet {t} sans mot-clé du site")
        if ("Stays in play" in sk) != st["stay"]: warn.append(f"st{st['id']}: Stays in play site={('Stays in play' in sk)} fiche={st['stay']}")
        if ("Permanent" in sk) != st["perm"]: warn.append(f"st{st['id']}: Permanent site={('Permanent' in sk)} fiche={st['perm']}")
        if cat == "negative" and "Friendly" in sk: warn.append(f"st{st['id']}: négative mais site dit Friendly")
        for m in re.findall(r"VERSION NOTE:\s*(.*?)</i>", rs["description"]):
            verify.append(f"Note de version du site (stage {st['id']}) : {strip(m)}")
    missing = sorted(set(s2o) - {st["id"] for st in stages})
    if missing: warn.append(f"stages du site non saisis : {missing}")
    for m in re.findall(r"VERSION NOTE:\s*(.*?)</i>", r["description"]):
        verify.append(f"Note de version du site : {strip(m)}")
    c = {"id": "%s-%03d" % (EXP, n), "expansion": EXP, "serial": n, "origin": "official",
         "images": {s: f"{EXP}/" + r["images"][s].split("/")[-1].rsplit(".", 1)[0] + ".webp" for s in ("front", "back")},
         "orientationToStage": o2s, "isParchment": kw.pop("parchment", False),
         "chooseSideOnDiscover": kw.pop("choose", False)}
    c.update(kw)
    c["stages"] = out
    if r["description"]: c["description"] = r["description"]
    c["source"] = {"url": r["url"], "scrapedAt": r["scrapedAt"]}
    c["confidence"] = conf; c["to_verify"] = verify
    with open(f"{ROOT}/data/cards/{EXP}/{n}.json", "w") as fh:
        json.dump(c, fh, ensure_ascii=False, indent=2); fh.write("\n")
    print(f"#{n} ok" + ("".join("\n   ⚠ " + w for w in warn)))
if __name__ == "__main__":
    show(int(sys.argv[1]), int(sys.argv[2]))
