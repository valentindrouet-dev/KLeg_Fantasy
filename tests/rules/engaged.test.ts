import { describe, expect, it } from "vitest";
import { applyAction, candidateActions, gainEffectOf, paymentCandidates, planWithEngaged, showsTopHalfOnly, type Action } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk } from "../helpers/game";

// Cartes engagées : elles ne produisent qu'au moment de payer (amélioration, effet).
describe("paiement avec des cartes engagées", async () => {
  const catalog = await loadCatalog();
  const upgrade = (n: number): Action => ({ type: "upgrade", card: fk(n), upgrade: "u1", discard: [] });

  it("améliore Wild Grass en produisant 2 cartes engagées, pas la troisième", () => {
    const s = arrange(catalog, { play: [1, 2, 3, 4], deck: [5, 6, 7, 8, 9] });
    const plan = planWithEngaged(catalog, s, upgrade(1), [fk(2), fk(3), fk(4)]);
    expect(plan?.map((a) => a.type)).toEqual(["produce", "produce", "upgrade"]);
    const end = plan?.reduce((st, a) => applyAction(catalog, st, a), s);
    expect(end?.zones.discard.slice(0, 3)).toContain(fk(1));
    expect(end?.lostResources).toEqual({}); // rien de gaspillé
  });

  it("n'utilise jamais la carte améliorée elle-même", () => {
    const s = arrange(catalog, { play: [1, 2] });
    expect(planWithEngaged(catalog, s, upgrade(1), [fk(1), fk(2)])).toBeNull();
  });

  it("choisit l'option du « / » qui convient (Festival pour du métal)", () => {
    // Carte 10 au verso : Festival, qui produit pièce / bois / pierre / métal au choix.
    const s = arrange(catalog, {
      play: [10, 9],
      orientation: { 10: { side: "back", rotation: 0 }, 9: { side: "front", rotation: 0 } },
      resources: { stone: 3, wood: 0 },
    });
    // Headquarters → Town Hall coûte 3 pierres + 1 bois : le Festival engagé donne le bois.
    const plan = planWithEngaged(catalog, s, upgrade(9), [fk(10)]);
    expect(plan?.[0]).toEqual({ type: "produce", card: fk(10), choices: [1] });
  });

  it("paie le coût d'un effet (Trader : dépenser 1 pièce)", () => {
    const s = arrange(catalog, { play: [10, 2] });
    const effect: Action = { type: "useEffect", card: fk(10), effect: "e1", targets: [], option: 0 };
    expect(planWithEngaged(catalog, s, effect, [fk(2)])).toEqual([
      { type: "produce", card: fk(2), choices: [0] },
      effect,
    ]);
  });

  it("liste les actions envisageables sans tenir compte des ressources (l'échange du Trader passe par l'engagement)", () => {
    const s = arrange(catalog, { play: [10] });
    expect(candidateActions(catalog, s, fk(10)).map((a) => a.type).sort()).toEqual(["upgrade"]);
    expect(gainEffectOf(catalog, s, fk(10))).toEqual({ effect: "e1", options: [["wood"]], cost: ["coin"] });
  });

  it("Avancer ne fait rien perdre tant que les cartes sont seulement engagées", () => {
    const s = arrange(catalog, { play: [2, 3], deck: [1, 4, 5] });
    const after = applyAction(catalog, s, { type: "advance" });
    expect(after.lostResources).toEqual({});
    const plan = planWithEngaged(catalog, after, upgrade(1), [fk(2), fk(3)]);
    expect(plan).not.toBeNull();
  });
});

describe("toucher l'effet d'abord, puis les cartes qui paient", async () => {
  const catalog = await loadCatalog();
  const rocky = { side: "front", rotation: 180 } as const;

  it("Rocky Area sans pièce : les cartes qui produisent des pièces peuvent payer, l'effet part une fois couvert", () => {
    const s = arrange(catalog, { play: [5, 1, 7], orientation: { 5: rocky } });
    const effect: Action = { type: "useEffect", card: fk(5), effect: "e1", targets: [], option: 0 };
    expect(planWithEngaged(catalog, s, effect, [])).toBeNull();
    // Wild Grass (1) produit une pièce ; Forest (7) du bois : seule la première peut payer.
    expect(paymentCandidates(catalog, s, effect, [])).toEqual([fk(1)]);
    const plan = planWithEngaged(catalog, s, effect, [fk(1)]);
    expect(plan).not.toBeNull();
    const after = (plan ?? []).reduce((st, a) => applyAction(catalog, st, a), s);
    expect(after.resources).toMatchObject({ coin: 0, stone: 2 });
  });

  it("une amélioration aussi : les cartes engagées s'ajoutent jusqu'à couvrir le coût", () => {
    const s = arrange(catalog, { play: [1, 2, 3], deck: [4, 5, 6, 7] });
    const up: Action = { type: "upgrade", card: fk(1), upgrade: "u1", discard: [] };
    expect(paymentCandidates(catalog, s, up, [])).toEqual([fk(2), fk(3)]);
    expect(planWithEngaged(catalog, s, up, [fk(2)])).toBeNull();
    expect(paymentCandidates(catalog, s, up, [fk(2)])).toEqual([fk(3)]);
    expect(planWithEngaged(catalog, s, up, [fk(2), fk(3)])).not.toBeNull();
  });
});

describe("pistes et demi-cartes", async () => {
  const catalog = await loadCatalog();
  it("Army : le coût est celui de la case suivante, les cartes à épées peuvent le payer", () => {
    const s = arrange(catalog, { play: [9], permanent: [25], orientation: { 9: { side: "front", rotation: 180 } } });
    const effect: Action = { type: "useEffect", card: fk(25), effect: "e1", targets: [], option: null };
    expect(paymentCandidates(catalog, s, effect, [])).toEqual([fk(9)]);
    expect(planWithEngaged(catalog, s, effect, [fk(9)])).not.toBeNull();
  });

  it("demi-carte : seulement les cartes « stays in play », jamais une carte à image pleine", () => {
    const s = arrange(catalog, { play: [1, 2, 14, 84], orientation: { 1: { side: "back", rotation: 0 }, 84: { side: "back", rotation: 0 } } });
    expect(showsTopHalfOnly(catalog, s, fk(1))).toBe(true); // Food Barns (stays in play)
    expect(showsTopHalfOnly(catalog, s, fk(84))).toBe(false); // Diamond Mine (dernier stage, mais ne reste pas en jeu)
    expect(showsTopHalfOnly(catalog, s, fk(2))).toBe(false); // Wild Grass
    expect(showsTopHalfOnly(catalog, s, fk(14))).toBe(false); // Bandit (image pleine)
  });
});

describe("productions qui dépendent des autres cartes", async () => {
  const catalog = await loadCatalog();
  it("Cathedral et une personne engagées paient Treasury : Cathedral produit d'abord, avec toutes les personnes", () => {
    // Cathedral (17 au stage 4) : 1 {coin} + 1 par personne ; Opportunist (29) : personne qui produit 1 {coin}.
    const s = arrange(catalog, { play: [17, 29, 10], permanent: [26], orientation: { 17: { side: "back", rotation: 0 } } });
    s.cards[fk(26)]!.checkedBoxes = ["1/c1", "1/c2"]; // case suivante : 3 {coin}
    const effect: Action = { type: "useEffect", card: fk(26), effect: "e1", targets: [], option: null };
    const plan = planWithEngaged(catalog, s, effect, [fk(29), fk(17)]);
    expect(plan?.[0]).toMatchObject({ type: "produce", card: fk(17) });
    const after = (plan ?? []).reduce((st, a) => applyAction(catalog, st, a), s);
    expect(after.cards[fk(26)]?.checkedBoxes).toContain("1/c3");
  });
});

describe("Export", async () => {
  const catalog = await loadCatalog();
  it("toutes les cartes engagées qui produisent des marchandises produisent, et tout part dans Export", () => {
    // Exotic Fruit Trees (20 et 21 au stage 4) : 2 {tradeGood} chacune.
    const s = arrange(catalog, { play: [20, 21, 1], permanent: [27], orientation: { 20: { side: "back", rotation: 0 }, 21: { side: "back", rotation: 0 } } });
    const effect: Action = { type: "useEffect", card: fk(27), effect: "e1", targets: [], option: null };
    expect(paymentCandidates(catalog, s, effect, [])).toEqual([fk(20), fk(21)]);
    const plan = planWithEngaged(catalog, s, effect, [fk(20), fk(21)]);
    expect(plan?.filter((a) => a.type === "produce").length).toBe(2);
    const after = (plan ?? []).reduce((st, a) => applyAction(catalog, st, a), s);
    expect(after.pending).toBeNull();
    expect(after.cards[fk(27)]?.tallies).toEqual({ "1": 4 });
    expect(after.resources.tradeGood).toBe(0);
  });
  it("Bazaar engagé sans or en réserve : la carte qui produit son {coin} peut payer (Farmlands, capture du 2026-10-04)", () => {
    const s = arrange(catalog, {
      play: [9, 19, 10, 1],
      deck: [2, 3, 4, 5],
      orientation: { 1: { side: "back", rotation: 180 }, 19: { side: "back", rotation: 180 }, 10: { side: "front", rotation: 180 } },
    });
    const up: Action = { type: "upgrade", card: fk(1), upgrade: "u1", discard: [] };
    const engaged = [fk(19), fk(10)]; // Lumberjack ({wood}{wood}), Bazaar ({coin} → {wood}/{stone})
    expect(planWithEngaged(catalog, s, up, engaged)).toBeNull();
    // Headquarters produit l'or de l'échange : elle est proposée pour payer.
    expect(paymentCandidates(catalog, s, up, engaged)).toEqual([fk(9)]);
    const plan = planWithEngaged(catalog, s, up, [...engaged, fk(9)]);
    const end = plan?.reduce((st, a) => applyAction(catalog, st, a), s);
    expect(end?.cards[fk(1)]?.orientation).toEqual({ side: "back", rotation: 0 }); // Food Barns
  });
});
