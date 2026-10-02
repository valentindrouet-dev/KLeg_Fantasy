import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions, ZONES, type GameState } from "../../src/engine";
import { mulberry } from "../helpers/random";
import { loadCatalog } from "../helpers/catalog";
import { newGame } from "../helpers/game";

// Parties jouées au hasard parmi les actions légales (réponses aux questions comprises) : aucune erreur,
// chaque carte dans une seule zone, jamais de ressource négative, et la partie se termine.
function invariants(s: GameState): void {
  const seen = new Map<string, number>();
  for (const z of ZONES) for (const id of s.zones[z] ?? []) seen.set(id, (seen.get(id) ?? 0) + 1);
  for (const id of Object.keys(s.cards)) expect(seen.get(id), id).toBe(1);
  for (const [r, n] of Object.entries(s.resources)) expect(n, r).toBeGreaterThanOrEqual(0);
}

describe("parties au hasard", async () => {
  const catalog = await loadCatalog();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    it(`graine ${seed}`, () => {
      const rand = mulberry(seed * 7919);
      let s = newGame(catalog, seed);
      let steps = 0;
      while (s.phase === "playing" && steps < 6000) {
        const actions = getLegalActions(catalog, s);
        // Passer moins souvent pour explorer les effets ; ne jamais annuler un choix.
        const pool = actions.filter((a) => a.type !== "cancelChoice");
        const weighted = pool.filter((a) => a.type !== "pass" || rand() < 0.15);
        const pick = (weighted.length ? weighted : pool)[Math.floor(rand() * (weighted.length ? weighted.length : pool.length))];
        if (!pick) break;
        s = applyAction(catalog, s, pick);
        invariants(s);
        steps++;
      }
      expect(s.phase).toBe("gameOver");
    });
  }
});
