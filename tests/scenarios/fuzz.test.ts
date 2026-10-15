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

// Ridding the Woods jouée au hasard après Merchants : ennemis, prisonniers, conditions d'état et interdictions ne
// bloquent jamais la partie, qui se termine sans erreur.
describe("Ridding the Woods au hasard", async () => {
  const catalog = await loadCatalog();
  for (const seed of [31, 32, 33, 34, 35, 36]) {
    it(`graine ${seed}`, () => {
      const rand = mulberry(seed * 7919);
      const play = (from: GameState): GameState => {
        let s = from;
        let steps = 0;
        while (s.phase === "playing" && steps < 10000) {
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
      s = play(applyAction(catalog, s, { type: "startGrandExpansion", expansion: "Merchants" }));
      expect(s.phase).toBe("gameOver");
      const before = Object.keys(s.cards).length;
      s = play(applyAction(catalog, s, { type: "startGrandExpansion", expansion: "RiddingTheWoods" }));
      expect(s.phase).toBe("gameOver");
      expect(Object.keys(s.cards)).toHaveLength(before + 30);
      expect(s.campaign?.played.at(-1)).toMatchObject({ expansion: "RiddingTheWoods", name: "Ridding the Woods" });
    }, GAME_TIMEOUT * 3);
  }
});

// Adventures jouée au hasard, puis Ridding the Woods (la carte des aventures continue de proposer ses lieux) : tourment,
// protections, carte des aventures et effets à cases ne bloquent jamais la partie.
describe("Adventures au hasard", async () => {
  const catalog = await loadCatalog();
  for (const seed of [41, 42, 43, 44, 45, 46]) {
    it(`graine ${seed}`, () => {
      const rand = mulberry(seed * 6007);
      const play = (from: GameState): GameState => {
        let s = from;
        let steps = 0;
        while (s.phase === "playing" && steps < 10000) {
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
      s = play(applyAction(catalog, s, { type: "startGrandExpansion", expansion: "FK_Adventures" }));
      expect(s.phase).toBe("gameOver");
      expect(Object.keys(s.cards)).toHaveLength(before + 29);
      expect(s.campaign?.played.at(-1)).toMatchObject({ expansion: "FK_Adventures", name: "Adventures" });
      s = play(applyAction(catalog, s, { type: "startGrandExpansion", expansion: "RiddingTheWoods" }));
      expect(s.phase).toBe("gameOver");
    }, GAME_TIMEOUT * 3);
  }
});
