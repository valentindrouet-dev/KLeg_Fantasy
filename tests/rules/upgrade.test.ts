import { describe, expect, it } from "vitest";
import { upgradeOptions } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, run } from "../helpers/game";

// Spec 4.4, action 2 : Améliorer. Règles d'or 1, 3 et 4.
describe("améliorer", async () => {
  const catalog = await loadCatalog();

  it("paie le coût, tourne la carte (↓), la défausse et termine le tour", () => {
    let s = arrange(catalog, { play: [1, 2], deck: [3, 4, 5, 6, 7], resources: { coin: 3 } });
    s = run(catalog, s, { type: "upgrade", card: fk(1), upgrade: "u1", discard: [] });
    expect(s.cards[fk(1)]?.orientation).toEqual({ side: "front", rotation: 180 }); // Plains
    expect(s.zones.discard).toEqual([fk(1), fk(2)]);
    expect(s.turn).toBe(2); // règle d'or 4 : le tour suivant a commencé
    expect(s.zones.play).toEqual([fk(3), fk(4), fk(5), fk(6)]);
    expect(Object.values(s.resources).every((n) => n === 0)).toBe(true); // la pièce restante est perdue
    expect(s.lostResources.coin).toBe(1);
  });

  it("→ retourne la carte sur l'autre face en gardant la rotation", () => {
    // Plains (front-180) → Farmlands (back-180) pour 3 pièces.
    let s = arrange(catalog, { play: [1], deck: [2], resources: { coin: 3 }, orientation: { 1: { side: "front", rotation: 180 } } });
    s = run(catalog, s, { type: "upgrade", card: fk(1), upgrade: "u1", discard: [] });
    expect(s.cards[fk(1)]?.orientation).toEqual({ side: "back", rotation: 180 });
  });

  it("impossible sans les ressources, avec la raison affichable", () => {
    const s = arrange(catalog, { play: [1], resources: { coin: 1 } });
    expect(legal(catalog, s).some((a) => a.type === "upgrade")).toBe(false);
    const [o] = upgradeOptions(catalog, s, fk(1));
    expect(o?.reason).toBe("Il manque {coin}");
  });

  it("une carte à deux améliorations propose les deux (Felled Forest)", () => {
    const s = arrange(catalog, { play: [7], resources: { stone: 1, coin: 3, wood: 1 }, orientation: { 7: { side: "front", rotation: 180 } } });
    const ups = legal(catalog, s).filter((a) => a.type === "upgrade");
    expect(ups.map((a) => (a.type === "upgrade" ? a.upgrade : "")).sort()).toEqual(["u1", "u2"]);
    const back = run(catalog, s, { type: "upgrade", card: fk(7), upgrade: "u2", discard: [] });
    expect(back.cards[fk(7)]?.orientation).toEqual({ side: "front", rotation: 0 }); // retour à Forest
  });

  it("une carte hors jeu ne s'améliore pas", () => {
    const s = arrange(catalog, { play: [2], discard: [1], resources: { coin: 5 } });
    expect(legal(catalog, s).some((a) => a.type === "upgrade" && a.card === fk(1))).toBe(false);
  });

  it("aucune carte ne change d'orientation sans règle (règle d'or 1)", () => {
    let s = arrange(catalog, { play: [1, 2, 3, 4], deck: [5, 6, 7, 8, 9, 10] });
    s = run(catalog, s, { type: "produce", card: fk(1), choices: [0] }, { type: "advance" }, { type: "pass" });
    for (const c of Object.values(s.cards)) expect(c.orientation).toEqual({ side: "front", rotation: 0 });
  });
});
