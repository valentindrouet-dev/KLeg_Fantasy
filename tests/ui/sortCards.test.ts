import { describe, expect, it } from "vitest";
import { sortPlay } from "../../src/ui/game/sortCards";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk } from "../helpers/game";

// Tri des cartes en jeu : par ressource produite, ou par type de carte.
describe("tri des cartes en jeu", async () => {
  const catalog = await loadCatalog();
  // Trader (personne, rien), Forest (terre, bois), Headquarters (bâtiment, pièce), Wild Grass (terre, pièce)
  const s = arrange(catalog, { play: [10, 7, 9, 1] });

  it("par ressources : pièces, puis bois, puis sans production ; à égalité, terres avant bâtiments", () => {
    expect(sortPlay(catalog, s, s.zones.play, "resources")).toEqual([fk(1), fk(9), fk(7), fk(10)]);
  });

  it("par type : terres, bâtiments, personnes ; à égalité, par ressource", () => {
    expect(sortPlay(catalog, s, s.zones.play, "type")).toEqual([fk(1), fk(7), fk(9), fk(10)]);
  });

  it("ordre d'arrivée : inchangé", () => {
    expect(sortPlay(catalog, s, s.zones.play, "arrival")).toEqual(s.zones.play);
  });
});
