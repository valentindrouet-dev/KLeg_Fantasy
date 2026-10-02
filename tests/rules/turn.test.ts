import { describe, expect, it } from "vitest";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, run } from "../helpers/game";

// Spec 4.4 : déroulé d'un tour, Avancer, Passer.
describe("tour de jeu", async () => {
  const catalog = await loadCatalog();

  it("Avancer joue 2 cartes de plus, puis 1 s'il n'en reste qu'une", () => {
    let s = arrange(catalog, { play: [1], deck: [2, 3, 4] });
    s = run(catalog, s, { type: "advance" });
    expect(s.zones.play).toEqual([fk(1), fk(2), fk(3)]);
    expect(s.zones.deck).toEqual([fk(4)]);
    s = run(catalog, s, { type: "advance" });
    expect(s.zones.play).toHaveLength(4);
    expect(s.zones.deck).toEqual([]);
  });

  it("Avancer est impossible avec un deck vide", () => {
    const s = arrange(catalog, { play: [1] });
    expect(legal(catalog, s).some((a) => a.type === "advance")).toBe(false);
  });

  it("Passer défausse les cartes en jeu et joue les 4 suivantes", () => {
    let s = arrange(catalog, { play: [1, 2], deck: [3, 4, 5, 6, 7] });
    s = run(catalog, s, { type: "pass" });
    expect(s.zones.discard).toEqual([fk(1), fk(2)]);
    expect(s.zones.play).toEqual([fk(3), fk(4), fk(5), fk(6)]);
    expect(s.zones.deck).toEqual([fk(7)]);
  });

  it("avec 1 à 3 cartes dans le deck, le tour suivant les joue toutes", () => {
    let s = arrange(catalog, { play: [1], deck: [2, 3] });
    s = run(catalog, s, { type: "pass" });
    expect(s.zones.play).toEqual([fk(2), fk(3)]);
  });

  it("une carte « stay in play » reste entre les tours", () => {
    // Carte 1 au verso : Food Barns (stage 4), stays in play.
    let s = arrange(catalog, { play: [1, 2], deck: [3, 4, 5, 6, 7], orientation: { 1: { side: "back", rotation: 0 } } });
    s = run(catalog, s, { type: "pass" });
    expect(s.zones.play).toContain(fk(1));
    expect(s.zones.discard).toEqual([fk(2)]);
  });

  it("produire avec une carte « stay in play » la défausse", () => {
    let s = arrange(catalog, { play: [1], deck: [2], orientation: { 1: { side: "back", rotation: 0 } } });
    s = run(catalog, s, { type: "produce", card: fk(1), choices: [0] });
    expect(s.zones.discard).toContain(fk(1));
  });
});
