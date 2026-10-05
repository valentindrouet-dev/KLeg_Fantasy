import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions, ZONES, type GameState } from "../../src/engine";
import { mulberry } from "../helpers/random";
import { loadCatalog } from "../helpers/catalog";
import { newGame } from "../helpers/game";

/** Une partie entière : 1 à 3 s en local, bien plus sur un serveur d'intégration chargé (5 s par défaut). */
const GAME_TIMEOUT = 30_000;

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
    }, GAME_TIMEOUT);
  }
});

// Extension Merchants jouée au hasard après une partie de base jouée au hasard : elle se termine, sans erreur, et
// aucune carte du royaume n'est perdue en route (demande du 2026-10-05 : ne rien supprimer).
describe("Merchants au hasard", async () => {
  const catalog = await loadCatalog();
  for (const seed of [21, 22, 23, 24, 25, 26]) {
    it(`graine ${seed}`, () => {
      const rand = mulberry(seed * 104729);
      const play = (from: GameState): GameState => {
        let s = from;
        let steps = 0;
        while (s.phase === "playing" && steps < 8000) {
          const pool = getLegalActions(catalog, s).filter((a) => a.type !== "cancelChoice");
          const weighted = pool.filter((a) => a.type !== "pass" || rand() < 0.15);
          const list = weighted.length ? weighted : pool;
          const pick = list[Math.floor(rand() * list.length)];
          if (!pick) break;
          s = applyAction(catalog, s, pick);
          invariants(s);
          steps++;
        }
        return s;
      };
      let s = play(newGame(catalog, seed));
      expect(s.phase).toBe("gameOver");
      const before = Object.keys(s.cards).length;
      s = applyAction(catalog, s, { type: "startGrandExpansion", expansion: "Merchants" });
      s = play(s);
      expect(s.phase).toBe("gameOver");
      expect(Object.keys(s.cards)).toHaveLength(before + 26);
      expect(s.campaign?.played.some((p) => p.expansion === "Merchants")).toBe(true);
    }, GAME_TIMEOUT * 2);
  }
});
