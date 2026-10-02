import { describe, expect, it } from "vitest";
import { computeScore } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, newGame, passUntil, run } from "../helpers/game";

// Spec 4.4 : fin de manche, découvertes, parchemins, dernière manche et score.
describe("manches et découvertes", async () => {
  const catalog = await loadCatalog();

  it("deck vide : fin de manche après le tour, découverte des 2 cartes suivantes, nouveau deck", () => {
    let s = newGame(catalog);
    s = passUntil(catalog, s, (x) => x.round === 2);
    expect(s.round).toBe(2);
    expect(s.turn).toBe(1);
    const kingdom = [...s.zones.deck, ...s.zones.play, ...s.zones.discard];
    expect(kingdom.sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(fk).sort());
    expect(s.zones.box).not.toContain(fk(11));
  });

  it("fin de manche : même les cartes « stay in play » sont défaussées puis remélangées", () => {
    let s = arrange(catalog, { play: [1, 2], orientation: { 1: { side: "back", rotation: 0 } } });
    s = run(catalog, s, { type: "pass" });
    expect(s.round).toBe(2);
    expect([...s.zones.deck, ...s.zones.play]).toContain(fk(1));
  });

  it("un parchemin en premier : lecture, instructions, destruction (parchemin 30 : 2 cartes parmi 31-34)", () => {
    let s = arrange(catalog, { play: [1], discard: [2, 3, 4, 5, 6] });
    s.zones.box = s.zones.box.filter((id) => (s.cards[id]?.serial ?? 0) >= 30 || s.cards[id]?.serial === 0);
    s = run(catalog, s, { type: "pass" });
    expect(s.pending).toEqual({ kind: "parchment", card: fk(30) });
    expect(legal(catalog, s)).toEqual([{ type: "acknowledgeParchment" }]);
    s = run(catalog, s, { type: "acknowledgeParchment" });
    expect(s.zones.destroyed).toEqual([fk(30)]);
    expect(s.pending).toMatchObject({ kind: "discoverChoice", options: [31, 32, 33, 34].map(fk), remaining: 2 });
    s = run(catalog, s, { type: "chooseDiscovery", card: fk(32) }, { type: "chooseDiscovery", card: fk(34) });
    expect(s.zones.destroyed.sort()).toEqual([30, 31, 33].map(fk).sort());
    const kingdom = [...s.zones.deck, ...s.zones.play, ...s.zones.discard];
    expect(kingdom).toContain(fk(32));
    expect(kingdom).toContain(fk(34));
    expect(s.turn).toBe(1);
  });

  it("parchemin 37 : 5 cartes découvertes, en choisissant la face de chaque objectif", () => {
    let s = arrange(catalog, { play: [1] });
    s.zones.box = s.zones.box.filter((id) => (s.cards[id]?.serial ?? 0) >= 37 || s.cards[id]?.serial === 0);
    s = run(catalog, s, { type: "pass" }, { type: "acknowledgeParchment" });
    const sides = ["front", "back", "front", "back", "front"] as const;
    for (const [i, side] of sides.entries()) {
      expect(s.pending).toEqual({ kind: "chooseSide", card: fk(38 + i) });
      s = run(catalog, s, { type: "chooseSide", side });
    }
    expect(s.cards[fk(39)]?.orientation).toEqual({ side: "back", rotation: 0 });
    expect(s.pending).toBeNull();
    expect(s.zones.box).not.toContain(fk(42));
  });

  it("la carte 68 lance la dernière manche ; à sa fin, la partie se termine avec le score", () => {
    let s = arrange(catalog, { play: [1], discard: [9], orientation: { 9: { side: "back", rotation: 0 } } });
    s.zones.box = s.zones.box.filter((id) => (s.cards[id]?.serial ?? 0) >= 68 || s.cards[id]?.serial === 0);
    s = run(catalog, s, { type: "pass" });
    expect(s.finalRound).toBe(true);
    s = run(catalog, s, { type: "acknowledgeParchment" }, { type: "chooseSide", side: "front" }, { type: "chooseSide", side: "front" });
    expect([...s.zones.deck, ...s.zones.play, ...s.zones.discard].sort()).toEqual([1, 9, 69, 70].map(fk).sort());
    s = passUntil(catalog, s, (x) => x.phase === "gameOver");
    expect(s.phase).toBe("gameOver");
    expect(legal(catalog, s)).toEqual([]);
    // Castle 12 + Royal Visit 2 (Wild Grass et Finishing Touch : 0).
    expect(computeScore(catalog, s).total).toBe(14);
  });

  it("la carte 0 n'est jamais découverte", () => {
    let s = arrange(catalog, { play: [1] });
    s.zones.box = [fk(0)];
    s = run(catalog, s, { type: "pass" });
    expect(s.zones.box).toEqual([fk(0)]);
    expect(s.round).toBe(2);
  });
});
