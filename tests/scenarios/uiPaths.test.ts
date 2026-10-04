import { describe, expect, it } from "vitest";
import {
  actionKey,
  applyAction,
  candidateActions,
  gainEffectOf,
  getLegalActions,
  sourceGroups,
  paymentCandidates,
  planWithEngaged,
  productionGroups,
  type GameState,
} from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { newGame } from "../helpers/game";
import { mulberry } from "../helpers/random";

// Chemins de l'interface (demande du 2026-10-02 : « vérifie toutes ces petites connexions ») : dans des situations
// tirées de parties au hasard, chaque effet et chaque amélioration que le moteur permet est proposé sur sa carte
// (candidateActions) et jouable tel quel (planWithEngaged) ; et ce qui manque de ressources peut se payer en
// touchant les cartes qui brillent (paymentCandidates), dès que les cartes en jeu suffisent.
describe("chemins de l'interface", async () => {
  const catalog = await loadCatalog();

  function check(s: GameState): void {
    const legal = getLegalActions(catalog, s).filter((a) => a.type === "useEffect" || a.type === "upgrade");
    for (const a of legal) {
      if (!("card" in a)) continue;
      // Gain au choix (Servant, Bazaar…) : proposé par l'engagement de la carte, pas dans son menu.
      if (a.type === "useEffect" && gainEffectOf(catalog, s, a.card)?.effect === a.effect) {
        expect(sourceGroups(catalog, s, a.card).length, `${a.card} engageable`).toBeGreaterThan(0);
        continue;
      }
      const offered = candidateActions(catalog, s, a.card).map(actionKey);
      expect(offered, `${a.type} ${a.card} proposé`).toContain(actionKey(a));
      expect(planWithEngaged(catalog, s, a, []), `${a.type} ${a.card} jouable`).not.toBeNull();
    }
    const producers = s.zones.play.filter((id) => productionGroups(catalog, s, id).length > 0);
    for (const card of [...s.zones.play, ...s.zones.permanent]) {
      for (const a of candidateActions(catalog, s, card)) {
        if (planWithEngaged(catalog, s, a, []) !== null) continue;
        const all = planWithEngaged(catalog, s, a, producers.filter((id) => id !== card));
        if (all === null) continue;
        // Payable avec les cartes en jeu : le chemin « toucher l'action puis les cartes » doit y mener.
        const payers = paymentCandidates(catalog, s, a, []);
        expect(payers.length, `${a.type} ${card} : cartes qui paient`).toBeGreaterThan(0);
        expect(planWithEngaged(catalog, s, a, payers), `${a.type} ${card} payable par les cartes proposées`).not.toBeNull();
      }
    }
  }

  for (const seed of [3, 7, 11, 19]) {
    it(`graine ${seed}`, () => {
      const rand = mulberry(seed * 101);
      let s = newGame(catalog, seed);
      for (let i = 0; i < 1500 && s.phase === "playing"; i++) {
        if (!s.pending) check(s);
        const acts = getLegalActions(catalog, s).filter((a) => a.type !== "cancelChoice");
        const w = acts.filter((a) => a.type !== "pass" || rand() < 0.15);
        const list = w.length ? w : acts;
        const pick = list[Math.floor(rand() * list.length)];
        if (!pick) break;
        s = applyAction(catalog, s, pick);
      }
    }, 120000);
  }
});
