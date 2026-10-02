import { describe, expect, it } from "vitest";
import { applyAction, candidateActions, paymentCandidates, planWithEngaged, type Action } from "../../src/engine";
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

  it("liste les actions envisageables sans tenir compte des ressources", () => {
    const s = arrange(catalog, { play: [10] });
    expect(candidateActions(catalog, s, fk(10)).map((a) => a.type).sort()).toEqual(["upgrade", "useEffect"]);
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
