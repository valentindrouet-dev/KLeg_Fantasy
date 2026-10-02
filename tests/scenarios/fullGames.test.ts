import { describe, expect, it } from "vitest";
import { act, current, getLegalActions, newSession, replay, type Session } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";

// Parties complètes jouées au hasard (graine fixe) : elles doivent aller jusqu'à la carte 68
// et se rejouer à l'identique depuis leur enregistrement.
describe("parties complètes", async () => {
  const catalog = await loadCatalog();

  function randomGame(seed: number): Session {
    let s = newSession(catalog, { expansion: "FeudalKingdom", seed, undoMode: "free" });
    let r = seed;
    for (let i = 0; i < 3000 && current(s).phase === "playing"; i++) {
      const legal = getLegalActions(catalog, current(s));
      r = (r * 1103515245 + 12345) % 2147483648;
      const action = legal[r % legal.length];
      if (!action) throw new Error("aucune action légale en cours de partie");
      s = act(s, action);
    }
    return s;
  }

  it.each([1, 2, 3])("graine %i : la partie se termine après la carte 68", (seed) => {
    const s = randomGame(seed);
    const end = current(s);
    expect(end.phase).toBe("gameOver");
    expect(end.zones.destroyed).toContain("FeudalKingdom-068");
    expect(end.zones.box).toContain("FeudalKingdom-071"); // au-delà de 70 : seulement par effet
    expect(current(replay(catalog, s.record))).toEqual(end);
  });
});
