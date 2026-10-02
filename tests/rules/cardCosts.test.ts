import { describe, expect, it } from "vitest";
import { parseOtherCost } from "../../src/engine/upgrade";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, run } from "../helpers/game";

// docs/RULES_DECISIONS.md : coûts « N Persons » payés en défaussant des personnes en jeu.
describe("coûts en cartes", async () => {
  const catalog = await loadCatalog();

  it("lit les coûts en cartes et refuse les autres", () => {
    expect(parseOtherCost("2 Persons")).toEqual([{ count: 2, keyword: "Person" }]);
    expect(parseOtherCost("2 persons")).toEqual([{ count: 2, keyword: "Person" }]);
    expect(parseOtherCost("2 Persons 2 Lands 2 Buildings")).toEqual([
      { count: 2, keyword: "Person" },
      { count: 2, keyword: "Land" },
      { count: 2, keyword: "Building" },
    ]);
    expect(parseOtherCost("2 seafaring")).toEqual([{ count: 2, keyword: "Seafaring" }]);
    expect(parseOtherCost("Destroy Stone Bridge")).toBeNull();
    expect(parseOtherCost(undefined)).toEqual([]);
  });

  it("Dungeon (59) : défausse 2 autres personnes en jeu, au choix", () => {
    // Personnes : Trader (10), Field Worker (13), Opportunist (29).
    let s = arrange(catalog, { play: [59, 10, 13, 29, 1], deck: [2], orientation: { 59: { side: "front", rotation: 180 } } });
    const ups = legal(catalog, s).filter((a) => a.type === "upgrade" && a.card === fk(59));
    expect(ups).toHaveLength(3);
    s = run(catalog, s, { type: "upgrade", card: fk(59), upgrade: "u1", discard: [fk(10), fk(29)] });
    expect(s.zones.discard.slice(0, 3)).toEqual([fk(10), fk(29), fk(59)]);
    expect(s.cards[fk(59)]?.orientation).toEqual({ side: "back", rotation: 180 });
  });

  it("impossible sans assez de personnes en jeu", () => {
    const s = arrange(catalog, { play: [59, 10, 1], orientation: { 59: { side: "front", rotation: 180 } } });
    expect(legal(catalog, s).some((a) => a.type === "upgrade" && a.card === fk(59))).toBe(false);
  });
});
