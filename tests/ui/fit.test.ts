import { describe, expect, it } from "vitest";
import type { Stage } from "../../src/data/schema";
import { stickerSpots } from "../../src/ui/game/stickerLayout";
import { BLOCKED_PEEK, CARD_ASPECT, fitCardWidth, fitSlots } from "../../src/ui/game/fitCards";

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

describe("emplacements de la zone de jeu", () => {
  it("sans ennemi ni blocage : même résultat qu'en comptant les cartes", () => {
    const slots = Array.from({ length: 10 }, () => ({ h: 1 }));
    const w = fitSlots(880, 560, slots, 12, 300);
    expect(Math.abs(w - fitCardWidth(880, 560, 10, 12, 300))).toBeLessThanOrEqual(1);
  });

  it("une ligne d'ennemis et une carte bloquée réduisent la taille, et tout tient", () => {
    const plain = fitSlots(880, 560, Array.from({ length: 6 }, () => ({ h: 1 })), 12, 300);
    const slots = [{ h: 1 }, { h: 1 + BLOCKED_PEEK, breakBefore: true }, { h: 1 }, { h: 1 }, { h: 1 }, { h: 1 }];
    const w = fitSlots(880, 560, slots, 12, 300);
    expect(w).toBeLessThan(plain);
    expect(w).toBeGreaterThan(120);
  });
});

describe("place des stickers", () => {
  it("juste après les ressources imprimées, sur la même rangée", () => {
    const stage = { production: [{ id: "p1", options: [["coin", "coin"]] }] } as unknown as Stage;
    const [first, second] = stickerSpots(stage, 2);
    // Farmlands : pièces imprimées à x = 19,5 et 73 px (sur 373), haut à 79 px (sur 520).
    expect(first?.left).toBeCloseTo((19.5 + 2 * 53.6) / 373);
    expect(second?.left).toBeCloseTo((19.5 + 3 * 53.6) / 373);
    expect(first?.top).toBeCloseTo(79 / 520);
  });

  it("rangée pleine : à droite de la gloire imprimée, plus bas", () => {
    const stage = { production: [{ id: "p1", options: [["stone", "metal", "metal", "tradeGood", "tradeGood"]] }, { id: "p2", options: [["coin"], ["wood"]] }] } as unknown as Stage;
    const [spot] = stickerSpots(stage, 1);
    expect(spot?.left).toBeCloseTo((19.5 + 53.6) / 373);
    expect(spot?.top).toBeCloseTo(135 / 520);
  });
});
