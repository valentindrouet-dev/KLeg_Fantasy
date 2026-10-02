import { describe, expect, it } from "vitest";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, run } from "../helpers/game";

// Spec 4.4, action 1 : Produire.
describe("produire", async () => {
  const catalog = await loadCatalog();

  it("défausse la carte et donne sa production", () => {
    let s = arrange(catalog, { play: [1, 2], deck: [3] });
    s = run(catalog, s, { type: "produce", card: fk(1), choices: [0] });
    expect(s.zones.discard).toEqual([fk(1)]);
    expect(s.resources.coin).toBe(1);
    expect(s.zones.play).toEqual([fk(2)]);
  });

  it("une carte sans production ne peut pas produire", () => {
    // Carte 10 au recto : Trader, aucune production.
    const s = arrange(catalog, { play: [10] });
    expect(legal(catalog, s).some((a) => a.type === "produce")).toBe(false);
  });

  it("le « / » est un choix du joueur (Festival : pièce, bois, pierre ou métal)", () => {
    let s = arrange(catalog, { play: [10], orientation: { 10: { side: "back", rotation: 0 } } });
    const produce = legal(catalog, s).filter((a) => a.type === "produce");
    expect(produce).toHaveLength(4);
    s = run(catalog, s, { type: "produce", card: fk(10), choices: [3] });
    expect(s.resources.metal).toBe(1);
    expect(s.resources.coin).toBe(0);
  });

  it("une carte défaussée par un effet ne produit pas", () => {
    // Plains (carte 1 tournée) défausse une autre carte amie : celle-ci ne rapporte rien d'elle-même.
    let s = arrange(catalog, { play: [1, 2], orientation: { 1: { side: "front", rotation: 180 } } });
    s = run(catalog, s, { type: "useEffect", card: fk(1), effect: "e1", targets: [fk(2)], option: null });
    expect(s.resources.coin).toBe(2);
    expect(s.zones.discard.sort()).toEqual([fk(1), fk(2)].sort());
  });
});
