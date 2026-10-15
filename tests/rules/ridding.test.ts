import { describe, expect, it } from "vitest";
import { cardId } from "../../src/data/schema";
import { applyAction, cardFame, computeScore, getLegalActions, productionGroups, type Action, type GameState, type InstanceId } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, run } from "../helpers/game";

// Extension Ridding the Woods (cartes 00 à 29) : lancement, purge 8 « focus 2{wood} », 5 manches de 5 découvertes,
// fin, ennemis, prisonniers et interdictions.
describe("extension Ridding the Woods", async () => {
  const catalog = await loadCatalog();
  const rtw = (n: number): InstanceId => cardId("RiddingTheWoods", n);

  const withRtw = (s: GameState): GameState => {
    for (const t of catalog.templates.values()) {
      if (t.expansion !== "RiddingTheWoods" || s.cards[t.id]) continue;
      s.cards[t.id] = { instanceId: t.id, templateId: t.id, serial: t.serial, orientation: { side: "front", rotation: 0 }, stickers: [], checkedBoxes: [], crossedOutEffects: [], crossedOutProduction: [] };
      s.zones.box.push(t.id);
    }
    return s;
  };
  const place = (s: GameState, zone: "play" | "deck" | "discard" | "permanent", ...serials: number[]): GameState => {
    for (const n of serials) {
      s.zones.box = s.zones.box.filter((id) => id !== rtw(n));
      s.zones[zone].push(rtw(n));
    }
    return s;
  };
  const back = (s: GameState, n: number): GameState => {
    const c = s.cards[rtw(n)];
    if (c) c.orientation = { side: "back", rotation: 0 };
    return s;
  };
  const choice = (s: GameState) => (s.pending?.kind === "choice" ? s.pending : null);
  const options = (s: GameState): InstanceId[] => {
    const r = choice(s)?.request;
    return r?.type === "cards" ? r.options : [];
  };
  const use = (s: GameState, card: InstanceId, effect = "e1"): GameState => {
    const a = legal(catalog, s).find((x) => x.type === "useEffect" && x.card === card && x.effect === effect);
    expect(a, `effet ${effect} de ${card}`).toBeDefined();
    return run(catalog, s, a as Action);
  };
  const pick = (s: GameState, ...cards: InstanceId[]): GameState => run(catalog, s, { type: "choose", answer: { cards } });

  function autoplay(s: GameState, done: (s: GameState) => boolean, max = 3000): GameState {
    let st = s;
    for (let i = 0; i < max && !done(st); i++) {
      const p = st.pending;
      let a: Action | undefined;
      if (p?.kind === "choice" && p.request.type === "cards") a = { type: "choose", answer: { cards: p.request.options.slice(0, p.request.min) } };
      else if (p) a = getLegalActions(catalog, st).find((x) => x.type !== "cancelChoice");
      else a = getLegalActions(catalog, st).find((x) => x.type === "pass");
      if (!a) break;
      st = applyAction(catalog, st, a);
    }
    return st;
  }

  /** Partie de base terminée : 24 cartes au deck (2 forêts parmi elles), Army et Treasury permanentes. */
  const finished = (): GameState => {
    const s = arrange(catalog, { deck: Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => ![23, 24, 25, 26, 27, 30].includes(n)), permanent: [25, 26] });
    s.phase = "gameOver";
    return s;
  };

  it("lancement : purge 8 avec focus 2{wood}, 2 permanentes, puis 5 cartes découvertes à chaque manche", () => {
    let s = run(catalog, finished(), { type: "startGrandExpansion", expansion: "RiddingTheWoods" });
    expect(s.pending).toEqual({ kind: "parchment", card: rtw(0) });
    s = run(catalog, s, { type: "acknowledgeParchment" });
    // 24 cartes : 3 paquets de 8. Tant que 2 cartes à {wood} ne sont pas choisies, le paquet n'en propose que s'il en a.
    // (Un paquet qui n'a qu'une carte possible est répondu d'office : la question suivante vient directement.)
    const woods = [fk(7), fk(8), fk(19)];
    let asked = 0;
    while ((choice(s)?.request.prompt ?? "").startsWith("Purge")) {
      const p = choice(s);
      const i = p?.answers.length ?? 0;
      const opts = options(s);
      const packet = s.zones.deck.slice(i * 8, (i + 1) * 8);
      const chosenWoods = (p?.answers ?? []).flatMap((a) => ("cards" in a ? a.cards : [])).filter((id) => woods.includes(id)).length;
      if (chosenWoods < 2 && packet.some((id) => woods.includes(id))) expect(opts.every((id) => woods.includes(id))).toBe(true);
      s = pick(s, opts[0] ?? "");
      asked += 1;
    }
    expect(asked).toBeGreaterThan(0);
    // 2 permanentes : purgées d'office ; puis la manche 1 découvre les cartes 1 à 5.
    expect(s.zones.purged).toEqual(expect.arrayContaining([fk(25), fk(26)]));
    expect(s.zones.purged).toHaveLength(5);
    expect(s.pending).toEqual({ kind: "newCards", cards: [1, 2, 3, 4, 5].map(rtw) });
    s = run(catalog, s, { type: "acknowledgeDiscoveries" });
    expect(s.campaign).toMatchObject({ grand: "RiddingTheWoods", rounds: 1 });
    expect(s.turn).toBe(1);
  });

  it("5 manches puis fin : les cartes 26 à 29 restent dans la boîte, A Certain Lady perd son effet", () => {
    let s = run(catalog, finished(), { type: "startGrandExpansion", expansion: "RiddingTheWoods" });
    s = autoplay(s, (x) => x.phase === "gameOver");
    expect(s.phase).toBe("gameOver");
    expect(s.campaign?.played.at(-1)).toEqual({ serial: 0, expansion: "RiddingTheWoods", name: "Ridding the Woods", score: computeScore(catalog, s).total });
    for (let n = 1; n <= 25; n++) expect(s.zones.box).not.toContain(rtw(n));
    expect(s.zones.box.filter((id) => id.startsWith("RiddingTheWoods")).sort()).toEqual([26, 27, 28, 29].map(rtw).filter((id) => s.zones.box.includes(id)).sort());
    expect(s.cards[rtw(1)]?.crossedOutEffects).toContain("1/e1");
    expect(legal(catalog, s).some((a) => a.type === "startGrandExpansion" && a.expansion === "RiddingTheWoods")).toBe(false);
  });

  it("Bandit : défausse les cartes qui produisent du {wood} ; vaincu, il devient Prisonnier", () => {
    let s = place(withRtw(arrange(catalog, { play: [7, 1], deck: [2, 3, 4], resources: { sword: 3 } })), "deck", 3);
    s.zones.deck = [rtw(3), ...s.zones.deck.filter((id) => id !== rtw(3))];
    // Avancer : le Bandit arrive, la forêt est défaussée.
    s = run(catalog, s, { type: "advance" });
    expect(s.zones.discard).toContain(fk(7));
    expect(s.zones.play).toContain(fk(1));
    s = use(s, rtw(3), "e2");
    expect(s.cards[rtw(3)]?.orientation.side).toBe("back");
  });

  it("Prisonnier : retourné quand 2 ennemis sont en jeu ; ajouté à la purge avec sa gloire", () => {
    let s = back(place(withRtw(arrange(catalog, { play: [1], deck: [2, 3, 4, 5] })), "play", 6, 11), 6);
    // Bandit (11 : Robber Veteran) et un second ennemi arrivent : le Prisonnier (6, verso) se retourne.
    s = place(s, "deck", 7);
    s.zones.deck = [rtw(7), ...s.zones.deck.filter((id) => id !== rtw(7))];
    s = run(catalog, s, { type: "advance" });
    expect(s.cards[rtw(6)]?.orientation.side).toBe("front");
    expect(s.zones.discard).toContain(rtw(6));
  });

  it("purge : jusqu'à 2 Prisonniers ajoutés ; Walled Outpost, Treasure Wagon et Sobbing ne valent leur gloire qu'à la purge", () => {
    let s = finished();
    s = withRtw(s);
    // Prisonniers 3 et 6 (verso), Walled Outpost (29, verso), Treasure Wagon (14) dans le royaume.
    s = place(s, "deck", 3, 6, 14, 29);
    back(s, 3);
    back(s, 6);
    back(s, 29);
    expect(cardFame(catalog, s, rtw(29))).toBe(5);
    s.phase = "gameOver";
    s = run(catalog, s, { type: "startExpansion", card: fk(136) });
    // Mini-extension : purge 12 (28 cartes au deck : 2 paquets), 1 permanente, puis les Prisonniers.
    while (choice(s) && !(choice(s)?.request.prompt ?? "").startsWith("Prisonniers")) {
      const opts = options(s);
      s = pick(s, opts.includes(rtw(29)) ? rtw(29) : opts.includes(rtw(14)) ? rtw(14) : (opts[0] ?? ""));
    }
    expect([...options(s)].sort()).toEqual([rtw(3), rtw(6)]);
    expect(choice(s)?.request).toMatchObject({ min: 1, max: 2, none: "Aucun prisonnier" });
    const before = s.purgedFame;
    s = pick(s, rtw(3), rtw(6));
    expect(s.zones.purged).toEqual(expect.arrayContaining([rtw(3), rtw(6)]));
    const purged = s.zones.purged.length;
    // Prisonniers : 2 chacun ; Walled Outpost : 5 + 2 par autre carte purgée ; Treasure Wagon : 5 par production.
    const wagon = s.zones.purged.includes(rtw(14)) ? 45 : 0;
    const outpost = s.zones.purged.includes(rtw(29)) ? 5 + 2 * (purged - 1) : 0;
    const others = s.zones.purged.filter((id) => ![rtw(3), rtw(6), rtw(14), rtw(29)].includes(id)).reduce((n, id) => n + cardFame(catalog, s, id), 0);
    expect(s.purgedFame - before).toBe(4 + wagon + outpost + others);
  });

  it("Robbin' Leader : seules les {sword} se gagnent ; vaincu 8 fois, il détruit A Certain Lady et se retourne", () => {
    let s = place(withRtw(arrange(catalog, { play: [1, 9], deck: [2, 3, 4, 5] })), "play", 2);
    s = place(s, "deck", 1);
    const lady = rtw(1);
    s = run(catalog, s, { type: "produce", card: fk(1), choices: [0] });
    expect(s.resources.coin ?? 0).toBe(0);
    for (let i = 0; i < 7; i++) s.cards[rtw(2)]?.checkedBoxes.push(`1/c${i + 1}`);
    s.resources.sword = 3;
    s = use(s, rtw(2), "e2");
    expect(s.zones.destroyed).toContain(lady);
    expect(s.cards[rtw(2)]?.orientation.side).toBe("back");
    expect(s.zones.discard).toContain(rtw(2));
  });

  it("camp de brigands : les {sword} ne paient plus que les améliorations", () => {
    let s = place(withRtw(arrange(catalog, { play: [1], deck: [2, 3], resources: { sword: 5 } })), "play", 8, 3);
    expect(legal(catalog, s).some((a) => a.type === "useEffect" && a.card === rtw(3))).toBe(false);
    expect(legal(catalog, s).some((a) => a.type === "upgrade" && a.card === rtw(8))).toBe(true);
    s.zones.play = s.zones.play.filter((id) => id !== rtw(8));
    expect(legal(catalog, s).some((a) => a.type === "useEffect" && a.card === rtw(3))).toBe(true);
  });

  it("Huge Robber : on ne peut plus avancer", () => {
    const s = place(withRtw(arrange(catalog, { play: [1], deck: [2, 3] })), "play", 7);
    expect(legal(catalog, s).some((a) => a.type === "advance")).toBe(false);
  });

  it("gardes : sans ennemi en jeu, ils sont défaussés", () => {
    let s = place(withRtw(arrange(catalog, { play: [1], deck: [2, 3, 4] })), "deck", 13);
    s.zones.deck = [rtw(13), ...s.zones.deck.filter((id) => id !== rtw(13))];
    s = run(catalog, s, { type: "advance" });
    expect(s.zones.discard).toContain(rtw(13));
  });

  it("Rogue Lady : raye 1 {coin} précise et coche une case", () => {
    let s = back(place(withRtw(arrange(catalog, { play: [1], deck: [2, 3, 4] })), "deck", 1), 1);
    s.zones.deck = [rtw(1), ...s.zones.deck.filter((id) => id !== rtw(1))];
    s = run(catalog, s, { type: "advance" });
    if (choice(s)) s = pick(s, fk(1));
    const crossed = [fk(1), fk(2)].filter((id) => (s.cards[id]?.crossedOutProduction.length ?? 0) > 0);
    expect(crossed).toHaveLength(1);
    expect(productionGroups(catalog, s, crossed[0] ?? "")).toEqual([]);
    expect(s.cards[rtw(1)]?.checkedBoxes).toEqual(["4/c1"]);
  });

  it("Unsafe Forest : vaincre un ennemi permet de payer pour la retourner", () => {
    let s = place(withRtw(arrange(catalog, { play: [1], deck: [2, 3], resources: { sword: 5, coin: 4 } })), "play", 4, 3);
    s.cards[rtw(4)]!.orientation = { side: "front", rotation: 180 };
    s = use(s, rtw(3), "e2");
    expect(choice(s)?.request).toMatchObject({ type: "option", labels: ["Oui", "Non"] });
    s = run(catalog, s, { type: "choose", answer: { option: 0 } });
    expect(s.cards[rtw(4)]?.orientation).toEqual({ side: "back", rotation: 180 });
  });

  it("Terrified Town : un ennemi joué fait défausser 3 cartes amies", () => {
    let s = place(withRtw(arrange(catalog, { play: [1, 2, 3, 4], deck: [5, 6] })), "play", 5);
    s = place(s, "deck", 6);
    s.zones.deck = [rtw(6), ...s.zones.deck.filter((id) => id !== rtw(6))];
    s = run(catalog, s, { type: "advance" });
    expect(choice(s)?.request).toMatchObject({ type: "cards", min: 3 });
    s = pick(s, fk(1), fk(2), fk(3));
    expect(s.zones.discard).toEqual(expect.arrayContaining([fk(1), fk(2), fk(3)]));
  });

  it("The Chase : la piste rouge avance à chaque fin de tour, la 3e case la détruit", () => {
    let s = place(withRtw(arrange(catalog, { play: [1], deck: [2, 3, 4, 5, 6] })), "play", 26);
    s.cards[rtw(26)]!.orientation = { side: "front", rotation: 180 };
    s.cards[rtw(26)]!.checkedBoxes = ["2/c4", "2/c5"];
    // The Chase n'est pas « Stays in play » : on la garde en jeu pour le test en la remettant après chaque tour.
    s = run(catalog, s, { type: "pass" });
    expect(s.zones.destroyed).toContain(rtw(26));
  });

  it("Large Dungeon : chaque prisonnier défaussé vaut 2 {fame}", () => {
    let s = back(place(withRtw(arrange(catalog, { play: [1], deck: [2, 3] })), "play", 9, 3), 3);
    s.cards[rtw(9)]!.orientation = { side: "back", rotation: 180 };
    s = use(s, rtw(9));
    expect(s.zones.discard).toContain(rtw(3));
    expect(s.zones.play).toContain(rtw(9));
    expect(cardFame(catalog, s, rtw(9))).toBe(2);
  });

  it("Treasury étendu : 50 + la plus haute case cochée (aussi pour Feudal Kingdom)", () => {
    const s = arrange(catalog, { permanent: [26], orientation: { 26: { side: "back", rotation: 0 } } });
    s.cards[fk(26)]?.checkedBoxes.push("4/c1");
    expect(cardFame(catalog, s, fk(26))).toBe(60);
  });
});
