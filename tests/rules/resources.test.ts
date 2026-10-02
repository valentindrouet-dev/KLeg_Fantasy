import { describe, expect, it } from "vitest";
import { addResourceSticker, canAddResourceSticker, productionCount } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, run } from "../helpers/game";

// Spec 4.5 (ressources éphémères) et règle d'or 5 (stickers).
describe("ressources", async () => {
  const catalog = await loadCatalog();

  it("perdues quand une nouvelle carte entre en jeu (Avancer)", () => {
    let s = arrange(catalog, { play: [1], deck: [2, 3], resources: { coin: 2, wood: 1 } });
    s = run(catalog, s, { type: "advance" });
    expect(s.resources).toMatchObject({ coin: 0, wood: 0 });
    expect(s.lostResources).toEqual({ coin: 2, wood: 1 });
  });

  it("perdues à la fin du tour", () => {
    let s = arrange(catalog, { play: [1, 2], deck: [3, 4, 5, 6, 7] });
    s = run(catalog, s, { type: "produce", card: fk(1), choices: [0] }, { type: "pass" });
    expect(s.resources.coin).toBe(0);
    expect(s.lostResources.coin).toBe(1);
  });

  it("conservées d'une action à l'autre dans le tour", () => {
    let s = arrange(catalog, { play: [1, 2, 3], deck: [4] });
    s = run(catalog, s, { type: "produce", card: fk(1), choices: [0] }, { type: "produce", card: fk(2), choices: [0] });
    expect(s.resources.coin).toBe(2);
    expect(s.lostResources).toEqual({});
  });
});

describe("règle d'or 5 : sticker de ressource refusé à 9 de production ou plus", async () => {
  const catalog = await loadCatalog();

  it("ajoute un sticker tant que la carte produit moins de 9", () => {
    const s = arrange(catalog, { play: [1] });
    expect(productionCount(catalog, s, fk(1))).toBe(1);
    expect(addResourceSticker(catalog, s, fk(1), "1", "coin")).toBe(true);
    expect(productionCount(catalog, s, fk(1))).toBe(2);
  });

  it("refuse le sticker à 9", () => {
    const s = arrange(catalog, { play: [1] });
    for (let i = 0; i < 8; i++) addResourceSticker(catalog, s, fk(1), "1", "coin");
    expect(productionCount(catalog, s, fk(1))).toBe(9);
    expect(canAddResourceSticker(catalog, s, fk(1))).toBe(false);
    expect(addResourceSticker(catalog, s, fk(1), "1", "coin")).toBe(false);
    expect(productionCount(catalog, s, fk(1))).toBe(9);
  });

  it("le sticker est sur le stage actif uniquement", () => {
    const s = arrange(catalog, { play: [1] });
    addResourceSticker(catalog, s, fk(1), "1", "coin");
    const c = s.cards[fk(1)];
    if (c) c.orientation = { side: "front", rotation: 180 };
    expect(productionCount(catalog, s, fk(1))).toBe(1); // Plains : sa propre production seulement
  });
});
