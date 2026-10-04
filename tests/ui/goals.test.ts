import { describe, expect, it } from "vitest";
import { goalOpen, goalView } from "../../src/ui/game/goals";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk } from "../helpers/game";

// Objectifs du joueur : étape visée en doré, avec la boîte d'amélioration du chemin qui y mène.
describe("objectifs", async () => {
  const catalog = await loadCatalog();
  it("Wild Grass vers l'étape 3 : passer d'abord par la flèche ↓ ; atteint, l'objectif tombe", () => {
    const s = arrange(catalog, { play: [1] });
    expect(goalView(catalog, s, [{ card: fk(1), stage: 3 }], fk(1))).toEqual({ stages: [3], arrows: ["rotate"] });
    s.cards[fk(1)]!.orientation = { side: "back", rotation: 180 };
    expect(goalOpen(catalog, s, { card: fk(1), stage: 3 })).toBe(false);
    expect(goalView(catalog, s, [{ card: fk(1), stage: 3 }], fk(1))).toBeUndefined();
  });
});
