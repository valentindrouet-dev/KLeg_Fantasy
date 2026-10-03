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

describe("faces à image pleine", async () => {
  const { loadCatalog } = await import("../helpers/catalog");
  const { isFullImageFace } = await import("../../src/engine");
  const { zoneAtCard } = await import("../../src/ui/game/cardZones");
  const catalog = await loadCatalog();
  const mason = [...catalog.templates.values()].find((t) => t.serial === 43);
  it("Mason (43) : recto à image pleine, verso à deux étapes ; toucher le texte du recto vise l'effet", () => {
    if (!mason) throw new Error("carte 43 absente");
    expect(isFullImageFace(mason, "front")).toBe(true);
    expect(isFullImageFace(mason, "back")).toBe(false);
    expect(zoneAtCard(0.5, 0.75, isFullImageFace(mason, "front"))).toBe("effect");
  });
});
