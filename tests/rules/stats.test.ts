import { describe, expect, it } from "vitest";
import { kingdomStats, printedStage } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { newGame } from "../helpers/game";

// Fenêtre « Stats » : comptes du royaume.
describe("statistiques du royaume", async () => {
  const catalog = await loadCatalog();

  it("royaume de départ : 10 cartes, production et mots-clés", () => {
    const st = kingdomStats(catalog, newGame(catalog));
    expect(st.cards).toMatchObject({ total: 10, play: 4, deck: 6, discard: 0, permanent: 0 });
    // 4 Wild Grass + 2 Distant Mountain + Headquarters = 7 pièces ; 2 Forest = 2 bois.
    expect(st.production).toMatchObject({ coin: 7, wood: 2, stone: 0 });
    expect(st.flexible).toBe(0);
    expect(Object.fromEntries(st.keywords)).toEqual({ Land: 8, Building: 1, Person: 1 });
    expect(st.fame).toBe(0);
    expect(st.stages).toEqual({ 1: 10, 2: 0, 3: 0, 4: 0 });
    expect(st.inBox).toBe(130);
  });

  it("cartes à une étape par face : verso numéroté 2 (le site dit 4)", () => {
    const fieldWorker = catalog.templates.get("FeudalKingdom-013");
    const wildGrass = catalog.templates.get("FeudalKingdom-001");
    if (!fieldWorker || !wildGrass) throw new Error("cartes manquantes");
    expect(printedStage(fieldWorker, 1)).toBe(1);
    expect(printedStage(fieldWorker, 4)).toBe(2);
    expect(printedStage(wildGrass, 4)).toBe(4);
  });
});
