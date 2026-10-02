import { describe, expect, it } from "vitest";
import { CARD_ASPECT, fitCardWidth } from "../../src/ui/game/fitCards";

// Spec 7.3 : la zone de jeu affiche toutes les cartes sans défilement.
describe("taille des cartes en jeu", () => {
  it("10 cartes tiennent dans une zone de iPad paysage, en 2 rangées", () => {
    const w = fitCardWidth(880, 560, 10, 12, 300);
    const cols = Math.floor((880 + 12) / (w + 12));
    const rows = Math.ceil(10 / cols);
    expect(rows * (w / CARD_ASPECT) + (rows - 1) * 12).toBeLessThanOrEqual(560);
    expect(w).toBeGreaterThan(150);
  });

  it("peu de cartes : taille plafonnée", () => {
    expect(fitCardWidth(1200, 800, 2, 12, 300)).toBe(300);
  });
});
