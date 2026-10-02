import { describe, expect, it } from "vitest";
import { playLayout, sortPlay } from "../../src/ui/game/sortCards";
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

describe("disposition de la zone de jeu", async () => {
  const catalog = await loadCatalog();
  it("ennemis, puis cartes « stays in play », puis les autres", () => {
    // Bandit (14, ennemi), Food Barns (1 au stage 4, stays in play), Forest (7), Trader (10)
    const s = arrange(catalog, { play: [7, 1, 14, 10], orientation: { 1: { side: "back", rotation: 0 } } });
    expect(playLayout(catalog, s, s.zones.play, "arrival")).toEqual({ enemies: [fk(14)], stays: [fk(1)], others: [fk(7), fk(10)] });
  });
});
