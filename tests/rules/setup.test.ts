import { describe, expect, it } from "vitest";
import { canRestartKingdom } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { fk, newGame } from "../helpers/game";

// Spec 4.3 : mise en place.
describe("mise en place", async () => {
  const catalog = await loadCatalog();

  it("les cartes 1 à 10 forment le royaume, le reste est dans la boîte", () => {
    const s = newGame(catalog);
    const kingdom = [...s.zones.deck, ...s.zones.play].sort();
    expect(kingdom).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(fk).sort());
    expect(s.zones.box).toHaveLength(130);
    expect(s.zones.discard).toEqual([]);
  });

  it("le premier tour joue les 4 cartes du dessus, sans découverte en manche 1", () => {
    const s = newGame(catalog);
    expect(s.round).toBe(1);
    expect(s.turn).toBe(1);
    expect(s.zones.play).toHaveLength(4);
    expect(s.zones.deck).toHaveLength(6);
  });

  it("le mélange ne change pas l'orientation des cartes", () => {
    const s = newGame(catalog);
    for (const c of Object.values(s.cards)) expect(c.orientation).toEqual({ side: "front", rotation: 0 });
  });

  it("le mélange est reproductible avec la même graine et change avec une autre", () => {
    expect(newGame(catalog, 42).zones.deck).toEqual(newGame(catalog, 42).zones.deck);
    const orders = new Set([1, 2, 3, 4, 5].map((seed) => newGame(catalog, seed).zones.deck.join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("aucune ressource au départ", () => {
    expect(Object.values(newGame(catalog).resources).every((n) => n === 0)).toBe(true);
  });

  it("le reset officiel est possible tant que la carte 23 est dans la boîte", () => {
    const s = newGame(catalog);
    expect(canRestartKingdom(s)).toBe(true);
    const after = structuredClone(s);
    after.zones.box = after.zones.box.filter((id) => id !== fk(23));
    after.zones.destroyed.push(fk(23));
    expect(canRestartKingdom(after)).toBe(false);
  });
});
