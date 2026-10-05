import { describe, expect, it } from "vitest";
import { cardId } from "../../src/data/schema";
import { applyAction, campaignSteps, computeScore, getLegalActions, type Action, type GameState, type InstanceId } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, run } from "../helpers/game";

// Extension Merchants (cartes 00 à 25) : lancement, manches menées par Merchants 01 puis 10, fin, effets des cartes.
describe("extension Merchants", async () => {
  const catalog = await loadCatalog();
  const mer = (n: number): InstanceId => cardId("Merchants", n);

  /** Ajoute les cartes de Merchants à la boîte (comme le lancement de l'extension). */
  const withMerchants = (s: GameState): GameState => {
    for (const t of catalog.templates.values()) {
      if (t.expansion !== "Merchants" || s.cards[t.id]) continue;
      s.cards[t.id] = { instanceId: t.id, templateId: t.id, serial: t.serial, orientation: { side: "front", rotation: 0 }, stickers: [], checkedBoxes: [], crossedOutEffects: [], crossedOutProduction: [] };
      s.zones.box.push(t.id);
    }
    return s;
  };
  /** Déplace des cartes de Merchants (depuis la boîte) dans une zone. */
  const place = (s: GameState, zone: "play" | "deck" | "discard" | "permanent", ...serials: number[]): GameState => {
    for (const n of serials) {
      s.zones.box = s.zones.box.filter((id) => id !== mer(n));
      s.zones[zone].push(mer(n));
    }
    return s;
  };
  const choice = (s: GameState) => (s.pending?.kind === "choice" ? s.pending : null);

  /** Joue sans rien faire : réponses par défaut aux questions, lectures confirmées, « Passer » sinon. */
  function autoplay(s: GameState, done: (s: GameState) => boolean, max = 2000): GameState {
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

  /** Partie de base terminée : 30 cartes dans le royaume, Army et Treasury permanentes. */
  const finished = (): GameState => {
    const s = arrange(catalog, { deck: Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => ![23, 24, 25, 26, 27].includes(n)), permanent: [25, 26] });
    s.phase = "gameOver";
    return s;
  };

  it("lancement : cartes ajoutées sans rien retirer, parchemin 00, purge 7 et 2 permanentes, puis Merchants 01", () => {
    const before = finished();
    let s = run(catalog, before, { type: "startGrandExpansion", expansion: "Merchants" });
    // Aucune carte du royaume n'est retirée : les 26 cartes de Merchants s'ajoutent.
    expect(Object.keys(s.cards)).toHaveLength(Object.keys(before.cards).length + 26);
    expect(s.zones.deck).toHaveLength(25);
    expect(s.pending).toEqual({ kind: "parchment", card: mer(0) });
    s = run(catalog, s, { type: "acknowledgeParchment" });
    // 25 cartes : 3 paquets de 7, puis 2 permanentes.
    expect(choice(s)?.request).toMatchObject({ type: "cards", prompt: "Purge : 1 carte à purger (paquet 1/3)", min: 1 });
    for (let i = 0; i < 3; i++) s = run(catalog, s, { type: "choose", answer: { cards: [(choice(s)?.request as { options: InstanceId[] }).options[0] ?? ""] } });
    // 2 permanentes seulement : purgées d'office.
    expect(s.zones.purged).toHaveLength(5);
    expect(s.zones.purged).toEqual(expect.arrayContaining([fk(25), fk(26)]));
    // Merchants 01 découverte (permanente), présentée avant la première manche.
    expect(s.zones.permanent).toContain(mer(1));
    expect(s.pending).toEqual({ kind: "newCards", cards: [mer(1)] });
    s = run(catalog, s, { type: "acknowledgeDiscoveries" });
    expect(s.turn).toBe(1);
    expect(s.campaign).toMatchObject({ grand: "Merchants", current: mer(1), rounds: 1 });
  });

  it("4 manches : Brigands, Merchants 10, puis fin avec le chemin de score ; les cartes non citées sont détruites", () => {
    let s = run(catalog, finished(), { type: "startGrandExpansion", expansion: "Merchants" });
    s = autoplay(s, (x) => x.campaign?.rounds === 1 && x.turn >= 1 && !x.pending);
    const r1 = s.round;
    s = autoplay(s, (x) => x.round > r1 && !x.pending);
    // Fin de la manche 1 : Brigands (Merchants 19, pas Feudal Kingdom 19) découverts, Merchants 01 retournée.
    expect(s.discoveredIds).toContain(mer(19));
    expect(s.discoveredIds).not.toContain(fk(19));
    expect(s.cards[mer(1)]?.orientation.side).toBe("back");
    const r2 = s.round;
    s = autoplay(s, (x) => x.round > r2 && !x.pending);
    expect(s.zones.destroyed).toContain(mer(1));
    expect(s.zones.permanent).toContain(mer(10));
    expect(s.campaign?.current).toBe(mer(10));
    s = autoplay(s, (x) => x.phase === "gameOver");
    expect(s.zones.destroyed).toContain(mer(10));
    expect(s.campaign?.played.at(-1)).toEqual({ serial: 0, expansion: "Merchants", name: "Merchants", score: computeScore(catalog, s).total });
    expect(s.campaign?.grand).toBeUndefined();
    // Rien de Merchants ne reste dans la boîte : aucune carte découverte n'en cite.
    expect(s.zones.box.filter((id) => id.startsWith("Merchants"))).toEqual([]);
    expect(legal(catalog, s).some((a) => a.type === "startGrandExpansion")).toBe(false);
    expect(campaignSteps(catalog, s).find((x) => x.id === "Merchants")).toMatchObject({ kind: "grand", status: "done" });
  });

  it("Merchants 01 : un choix par carte proposée, payé, qui découvre la carte de Merchants et finit le tour", () => {
    let s = place(withMerchants(arrange(catalog, { play: [1], deck: [2, 3, 4, 5, 6], resources: { coin: 7, tradeGood: 4 } })), "permanent", 1);
    const uses = legal(catalog, s).filter((a) => a.type === "useEffect" && a.card === mer(1));
    expect(uses.map((a) => (a.type === "useEffect" ? a.option : null))).toEqual([0, 1]); // Camels (7 {coin}), Spices (4 {tradeGood})
    s = run(catalog, s, { type: "useEffect", card: mer(1), effect: "e1", targets: [], option: 0 });
    expect(s.resources.coin).toBe(0);
    expect(s.zones.box).not.toContain(mer(2));
    expect(s.discoveredIds?.at(-1)).toBe(mer(2));
    expect(s.pending).toEqual({ kind: "newCards", cards: [mer(2)] });
  });

  it("épices : Spices tourne vers n'importe quelle orientation ; Cummin coche et rapporte, puis reset une fois complète", () => {
    let s = place(withMerchants(arrange(catalog, { play: [13], deck: [2, 3, 4] })), "play", 3);
    // Une seule personne : défaussée d'office ; reste l'orientation.
    s = run(catalog, s, { type: "useEffect", card: mer(3), effect: "e1", targets: [], option: null });
    expect(choice(s)?.request).toMatchObject({ type: "option", labels: ["Cummin", "Turmeric", "Coriander"] });
    s = run(catalog, s, { type: "choose", answer: { option: 0 } });
    expect(s.cards[mer(3)]?.orientation).toEqual({ side: "front", rotation: 180 });
    // Cummin : 3 cases déjà cochées, la 4e rapporte 3 {coin} et remet la carte à Spices.
    s.zones.discard = s.zones.discard.filter((id) => id !== mer(3));
    s.zones.play.push(mer(3));
    s.cards[mer(3)]!.checkedBoxes = ["2/c1", "2/c2", "2/c3"];
    s = run(catalog, s, { type: "useEffect", card: mer(3), effect: "e1", targets: [], option: null });
    expect(s.resources.coin).toBe(3);
    expect(s.cards[mer(3)]?.orientation).toEqual({ side: "front", rotation: 0 });
    expect(s.zones.discard).toContain(mer(3));
  });

  it("Turmeric : l'effet d'une personne en jeu, sans la défausser", () => {
    let s = place(withMerchants(arrange(catalog, { play: [10], deck: [2, 3], resources: { coin: 1 } })), "play", 3);
    s.cards[mer(3)]!.orientation = { side: "back", rotation: 0 };
    s = run(catalog, s, { type: "useEffect", card: mer(3), effect: "e1", targets: [], option: null });
    expect(s.resources).toMatchObject({ coin: 0, wood: 1 });
    expect(s.zones.play).toContain(fk(10));
    expect(s.cards[mer(3)]?.checkedBoxes).toEqual(["4/c1"]);
  });

  it("fourrures : sticker 18 (effet « sous la pioche ») et sticker 17 (commence la manche en jeu) sur une personne", () => {
    let s = place(withMerchants(arrange(catalog, { play: [13], deck: [2, 3, 4] })), "play", 4);
    s.cards[mer(4)]!.orientation = { side: "front", rotation: 180 }; // Camel Fur
    s = run(catalog, s, { type: "useEffect", card: mer(4), effect: "e1", targets: [], option: null });
    expect(s.cards[fk(13)]?.stickers).toEqual([{ sticker: "18", stage: 1, effect: "Place this at the bottom of your deck." }]);
    expect(s.cards[mer(4)]?.orientation).toEqual({ side: "back", rotation: 180 }); // Cheeta Fur
    expect(legal(catalog, s)).toContainEqual({ type: "useEffect", card: fk(13), effect: "sticker18", targets: [], option: null });
    s = run(catalog, s, { type: "useEffect", card: fk(13), effect: "sticker18", targets: [], option: null });
    expect(s.zones.deck.at(-1)).toBe(fk(13));
    // Sticker 17 : la personne commence la manche suivante en jeu, sans être « jouée ».
    s.cards[fk(13)]!.stickers.push({ sticker: "17", stage: 1, startsInPlay: true });
    s.zones.deck = [fk(13)];
    s = autoplay(s, (x) => x.round === 2 && x.turn === 1);
    expect(s.zones.play).toContain(fk(13));
  });

  it("Weaving : défausser 1 personne et payer la case suivante ; la gloire vaut la plus haute case cochée", () => {
    let s = place(withMerchants(arrange(catalog, { play: [13], deck: [2, 3], resources: { coin: 2 } })), "permanent", 5);
    s = run(catalog, s, { type: "useEffect", card: mer(5), effect: "e1", targets: [], option: null });
    expect(s.zones.discard).toContain(fk(13));
    expect(s.cards[mer(5)]?.checkedBoxes).toEqual(["1/c1"]);
    expect(s.resources.coin).toBe(0);
    expect(computeScore(catalog, s).lines.find((l) => l.card === mer(5))?.fame).toBe(1);
  });

  it("Hangover : chaque personne jouée est défaussée et coche une case ; Too Much Mead fait perdre 3 ressources", () => {
    let s = place(withMerchants(arrange(catalog, { deck: [13, 2, 3, 4, 5, 6] })), "play", 12);
    s.cards[mer(12)]!.orientation = { side: "back", rotation: 0 };
    s = run(catalog, s, { type: "advance" });
    expect(s.zones.discard).toContain(fk(13));
    expect(s.cards[mer(12)]?.checkedBoxes).toEqual(["4/c1"]);
    let m = place(withMerchants(arrange(catalog, { deck: [2, 3, 4, 5, 6] })), "deck", 16);
    m.zones.deck.unshift(m.zones.deck.pop() ?? "");
    m.cards[mer(16)]!.orientation = { side: "back", rotation: 0 };
    m = run(catalog, m, { type: "advance" });
    expect(m.loseNext).toBe(3);
  });

  it("Brigands : ni avancer, ni améliorer, ni autre effet {time} ; leur propre défaite reste possible", () => {
    const s = place(withMerchants(arrange(catalog, { play: [1], deck: [2, 3], resources: { sword: 8, coin: 7 } })), "play", 19);
    place(s, "permanent", 1);
    const actions = legal(catalog, s);
    expect(actions.some((a) => a.type === "advance")).toBe(false);
    expect(actions.some((a) => a.type === "useEffect" && a.card === mer(1))).toBe(false);
    expect(actions).toContainEqual({ type: "useEffect", card: mer(19), effect: "e3", targets: [], option: null });
    const after = run(catalog, s, { type: "useEffect", card: mer(19), effect: "e3", targets: [], option: null });
    expect(after.cards[mer(19)]?.orientation.side).toBe("back"); // Brigand Boss
  });

  it("fin de manche de Merchants 01 : retournée même si Brigands n'est plus dans la boîte", () => {
    let s = place(withMerchants(arrange(catalog, { play: [1], deck: [] })), "permanent", 1);
    place(s, "discard", 19);
    s.queue = [];
    s = run(catalog, s, { type: "pass" });
    s = autoplay(s, (x) => x.round > 1);
    expect(s.cards[mer(1)]?.orientation.side).toBe("back");
  });

  it("les cartes citées par numéro sont celles de la carte qui les cite (Camel Herd → Merchants 24 / 25)", () => {
    let s = place(withMerchants(arrange(catalog, { play: [1], deck: [2, 3] })), "play", 2);
    s.cards[mer(2)]!.orientation = { side: "back", rotation: 180 }; // Camel Herd
    s = run(catalog, s, { type: "useEffect", card: mer(2), effect: "e1", targets: [], option: null });
    expect(s.zones.box).not.toContain(mer(24));
    expect(s.zones.box).toContain(fk(24));
    expect(s.zones.box).toContain(mer(25));
  });
});
