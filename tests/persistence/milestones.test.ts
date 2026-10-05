import { describe, expect, it } from "vitest";
import { exportKingdom, importKingdom } from "../../src/persistence/backup";
import { summarize, updateMilestones, type Kingdom } from "../../src/persistence/kingdoms";
import { newSession, current, type GameState } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { arrange } from "../helpers/game";

// Jalons de la campagne (tableau des scores) : ajoutés quand une étape finit, jamais inventés pour les étapes finies
// avant leur introduction, retirés si une annulation défait l'étape. Rien d'autre du royaume n'est touché.
describe("jalons de la campagne", async () => {
  const catalog = await loadCatalog();
  const kingdom = (state: GameState, extra: Partial<Kingdom> = {}): Kingdom => {
    const s = newSession(catalog, { expansion: "FeudalKingdom", seed: 3, undoMode: "free" });
    return { id: "k", name: "K", emoji: "🏰", createdAt: 1, updatedAt: 1, summary: summarize(catalog, s.record, state), record: s.record, state, ...extra };
  };
  const playing = arrange(catalog, { play: [1], deck: [2, 3] });
  const over = (() => {
    const s = structuredClone(playing);
    s.phase = "gameOver";
    return s;
  })();

  it("la fin de la partie de base est notée avec sa date et le temps de jeu", () => {
    expect(updateMilestones(catalog, kingdom(playing, { playMs: 5000 }), over, 1234)).toEqual([{ step: "base", at: 1234, playMs: 5000 }]);
  });
  it("une étape finie avant (sans jalon) n'en reçoit pas d'inventé", () => {
    expect(updateMilestones(catalog, kingdom(over), over, 1234)).toBeUndefined();
  });
  it("une annulation qui défait l'étape retire son jalon", () => {
    const k = kingdom(over, { milestones: [{ step: "base", at: 1, playMs: 2 }] });
    expect(updateMilestones(catalog, k, playing, 9)).toEqual([]);
  });
  it("les jalons passent par la sauvegarde exportée", () => {
    const s = current(newSession(catalog, { expansion: "FeudalKingdom", seed: 3, undoMode: "free" }));
    const k = kingdom(s, { milestones: [{ step: "base", at: 7, playMs: 8 }] });
    expect(importKingdom(catalog, exportKingdom(k, "v0.57"), []).milestones).toEqual([{ step: "base", at: 7, playMs: 8 }]);
  });
});
