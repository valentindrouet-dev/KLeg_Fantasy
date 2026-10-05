import { describe, expect, it } from "vitest";
import { referencedSerials } from "../../src/ui/game/cardRefs";
import { loadCatalog } from "../helpers/catalog";
import { fk } from "../helpers/game";

// Cartes citées par le texte d'une carte, consultables depuis son inspection (demande du 2026-10-05).
describe("cartes citées", async () => {
  const catalog = await loadCatalog();
  const refs = (n: number) => referencedSerials(catalog.templates.get(fk(n))!);
  it("numéros entre parenthèses, listes « / »", () => {
    expect(refs(8)).toEqual([82, 83]); // Sacred Well : Discover Shrine (82 / 83)
    expect(refs(12)).toEqual([71, 72, 73, 74]); // Explorers : Discover a new region (71 / 72 / 73 / 74)
    expect(refs(27)).toEqual([86, 107, 117]); // Export, Mass Export
  });
  it("« cards 31-34 », « cards 24-27 » : les plages", () => {
    expect(refs(30)).toEqual([31, 32, 33, 34]);
    expect(refs(23)).toEqual([24, 25, 26, 27]);
  });
  it("une carte sans renvoi n'a rien, et jamais elle-même", () => {
    expect(refs(1)).toEqual([]);
    for (const t of catalog.templates.values()) expect(referencedSerials(t)).not.toContain(t.serial);
  });
});
