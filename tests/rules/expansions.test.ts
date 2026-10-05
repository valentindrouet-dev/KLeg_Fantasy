import { describe, expect, it } from "vitest";
import { act, campaignStage, campaignSteps, canUndo, computeScore, current, productionGroups, resumeSession, undo, type Action, type GameState } from "../../src/engine";
import { purgeFame } from "../../src/engine/campaign";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, passUntil, run } from "../helpers/game";

// Mini-extensions 136, 137, 138 et purge (spec 4.7).
describe("purge et mini-extensions", async () => {
  const catalog = await loadCatalog();
  const choice = (s: GameState) => (s.pending?.kind === "choice" ? s.pending : null);
  /** Partie de base terminée : 30 cartes dans le royaume, Army et Treasury permanentes. */
  const finished = (): GameState => {
    const s = arrange(catalog, { deck: Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => ![23, 24, 25, 26, 27].includes(n)), permanent: [25, 26] });
    s.phase = "gameOver";
    return s;
  };
  /** Répond à la purge : la première carte proposée à chaque question. */
  const purgeFirst = (s: GameState): GameState => {
    let st = s;
    for (let i = 0; i < 20 && choice(st)?.script === "campaign:purge12"; i++) {
      const r = choice(st)?.request;
      if (r?.type !== "cards") break;
      st = run(catalog, st, { type: "choose", answer: { cards: r.options.slice(0, r.min) } });
    }
    return st;
  };

  it("après la partie, les trois mini-extensions sont proposées ; en lancer une commence par la purge 12", () => {
    let s = finished();
    expect(legal(catalog, s)).toEqual([...[136, 137, 138].map((n) => ({ type: "startExpansion", card: fk(n) })), { type: "startGrandExpansion", expansion: "Merchants" }]);
    const base = computeScore(catalog, s).total;
    s = run(catalog, s, { type: "startExpansion", card: fk(136) });
    expect(s.phase).toBe("playing");
    expect(s.zones.permanent).toContain(fk(136));
    expect(s.campaign?.base).toBe(base);
    // 25 cartes dans le deck : 2 paquets de 12, puis 1 permanente.
    expect(choice(s)?.request).toMatchObject({ type: "cards", prompt: "Purge : 1 carte à purger (paquet 1/2)", min: 1, max: 1 });
    s = purgeFirst(s);
    expect(s.zones.purged).toHaveLength(3);
    expect(s.zones.purged.some((id) => [fk(25), fk(26)].includes(id))).toBe(true);
    expect(s.round).toBe(2);
    expect(s.turn).toBe(1);
  });

  it("purge : chaque choix s'annule tant qu'elle n'est pas finie, plus jamais ensuite (même en mode Libre)", () => {
    let sess = resumeSession(catalog, { config: { ...finished().config, undoMode: "free" }, actions: [] }, finished());
    sess = act(sess, { type: "startExpansion", card: fk(137) });
    const first = (sess2: typeof sess) => {
      const r = choice(current(sess2))?.request;
      return r?.type === "cards" ? r.options.slice(0, r.min) : [];
    };
    sess = act(sess, { type: "choose", answer: { cards: first(sess) } });
    expect(choice(current(sess))?.request.prompt).toBe("Purge : 1 carte à purger (paquet 2/2)");
    // On revient sur le paquet 1.
    expect(canUndo(sess)).toBe(true);
    sess = undo(sess);
    expect(choice(current(sess))?.request.prompt).toBe("Purge : 1 carte à purger (paquet 1/2)");
    for (let i = 0; i < 5 && choice(current(sess))?.script === "campaign:purge12"; i++) sess = act(sess, { type: "choose", answer: { cards: first(sess) } });
    expect(current(sess).zones.purged).toHaveLength(3);
    expect(sess.record.undoFloor).toBe(sess.record.actions.length);
    expect(canUndo(sess)).toBe(false);
  });

  it("la gloire des cartes purgées est cumulée ; Temple of Light compte +10 par case cochée", () => {
    const s = arrange(catalog, { play: [125, 1], orientation: { 125: { side: "back", rotation: 0 } } });
    s.cards[fk(125)]!.checkedBoxes = ["4/c1", "4/c2"];
    expect(purgeFame({ catalog, s }, fk(125))).toBe(30 + 20); // Temple of Light : 30 {fame}, 2 cases cochées
  });

  it("4 manches sans découverte, la carte change d'étape chaque fin de manche, puis la partie se termine avec le chemin de score", () => {
    let s = run(catalog, finished(), { type: "startExpansion", card: fk(137) });
    s = purgeFirst(s);
    const box = s.zones.box.length;
    const stages: (number | undefined)[] = [];
    for (let round = 0; round < 4 && s.phase === "playing"; round++) {
      const r = s.round;
      stages.push(s.cards[fk(137)]?.orientation.side === "front" ? (s.cards[fk(137)]?.orientation.rotation === 0 ? 1 : 2) : s.cards[fk(137)]?.orientation.rotation === 180 ? 3 : 4);
      s = passUntil(catalog, s, (x) => x.round !== r || x.phase === "gameOver");
    }
    expect(stages).toEqual([1, 2, 3, 4]);
    expect(s.phase).toBe("gameOver");
    expect(s.zones.destroyed).toContain(fk(137));
    expect(s.zones.box.length).toBeLessThanOrEqual(box); // aucune découverte de début de manche
    expect(s.campaign?.played).toEqual([{ serial: 137, name: "The Water Mill", score: computeScore(catalog, s).total }]);
    expect(s.campaign?.current).toBeNull();
    // Une extension jouée n'est plus proposée.
    expect(legal(catalog, s)).toEqual([...[136, 138].map((n) => ({ type: "startExpansion", card: fk(n) })), { type: "startGrandExpansion", expansion: "Merchants" }]);
  });

  it("Surplus : une terre qui produit {coin} peut produire {tradeGood} à la place", () => {
    const s = arrange(catalog, { play: [1], permanent: [137], orientation: { 137: { side: "back", rotation: 180 } } });
    expect(productionGroups(catalog, s, fk(1))[0]?.options).toEqual([["coin"], ["tradeGood"]]);
  });

  it("The Water Mill : 3 {coin} une fois par tour", () => {
    let s = arrange(catalog, { play: [1], permanent: [137], deck: [2, 3, 4, 5] });
    const mill: Action = { type: "useEffect", card: fk(137), effect: "e1", targets: [], option: null };
    s = run(catalog, s, mill);
    expect(s.resources.coin).toBe(3);
    expect(legal(catalog, s)).not.toContainEqual(mill);
  });

  it("Border Dispute : les terres restent en jeu", () => {
    let s = arrange(catalog, { play: [1, 9], permanent: [138], deck: [2, 3, 4, 5] });
    s = run(catalog, s, { type: "pass" });
    expect(s.zones.play).toContain(fk(1));
    expect(s.zones.play).not.toContain(fk(9));
  });

  it("Uprising : une personne jouée alors qu'une personne est en jeu coche une case", () => {
    let s = arrange(catalog, { play: [13], permanent: [136], deck: [42, 1, 2, 3], orientation: { 136: { side: "back", rotation: 180 } } });
    s = run(catalog, s, { type: "advance" });
    expect(s.cards[fk(136)]?.checkedBoxes).toEqual(["3/c1"]);
  });
  it("campagne : étapes et statut, le royaume n'est jamais clôturé", () => {
    let s = finished();
    expect(campaignStage(s)).toBe("between");
    const base = computeScore(catalog, s).total;
    expect(campaignSteps(catalog, s).map((x) => [x.id, x.status, x.score])).toEqual([
      ["base", "done", base],
      ["136", "available", null],
      ["137", "available", null],
      ["138", "available", null],
      ["Merchants", "available", null],
    ]);
    s = purgeFirst(run(catalog, s, { type: "startExpansion", card: fk(137) }));
    expect(campaignStage(s)).toBe("expansion");
    expect(campaignSteps(catalog, s).find((x) => x.id === "137")).toMatchObject({ status: "current", round: 1 });
    for (let round = 0; round < 4 && s.phase === "playing"; round++) {
      const r = s.round;
      s = passUntil(catalog, s, (x) => x.round !== r || x.phase === "gameOver");
    }
    expect(campaignStage(s)).toBe("between");
    expect(campaignSteps(catalog, s).find((x) => x.id === "137")).toMatchObject({ status: "done", score: computeScore(catalog, s).total });
    // Toutes jouées : en attente de nouvelles extensions, jamais « terminé ».
    s.campaign!.played.push({ serial: 136, name: "x", score: 0 }, { serial: 138, name: "y", score: 0 });
    for (const n of [136, 138]) s.zones.box = s.zones.box.filter((id) => id !== fk(n));
    expect(campaignStage(s)).toBe("waiting");
    // Merchants reste à jouer : seul le catalogue le sait.
    expect(campaignStage(s, catalog)).toBe("between");
  });

  it("partie de base en cours : étape courante avec sa manche", () => {
    const s = arrange(catalog, { play: [1], deck: [2, 3] });
    expect(campaignStage(s)).toBe("base");
    expect(campaignSteps(catalog, s)[0]).toMatchObject({ id: "base", status: "current", round: s.round });
  });
});
