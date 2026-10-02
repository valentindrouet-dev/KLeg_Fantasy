import { describe, expect, it } from "vitest";
import { zoneAt } from "../../src/ui/game/cardZones";

// Repères mesurés sur les images 373 × 520 (cartes 1, 5, 7, 9, 10).
const at = (px: number, py: number) => zoneAt(px / 373, py / 520);

describe("zones cliquables d'une carte", () => {
  it("production sous le bandeau (pièce de Wild Grass, rangée du Festival)", () => {
    expect(at(40, 105)).toBe("production");
    expect(at(250, 105)).toBe("production");
  });
  it("boîte d'amélioration ↓ à droite contre la ligne du milieu (Wild Grass, Trader)", () => {
    expect(at(310, 225)).toBe("upgradeRotate");
  });
  it("boîte d'amélioration → en haut à droite (Forest)", () => {
    expect(at(325, 60)).toBe("upgradeFlip");
  });
  it("texte d'effet au centre (Forest, Trader)", () => {
    expect(at(180, 200)).toBe("effect");
  });
  it("la moitié basse est le stage suivant, pas une action", () => {
    expect(at(180, 400)).toBe("bottom");
  });
});
