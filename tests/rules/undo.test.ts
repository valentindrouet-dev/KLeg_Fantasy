import { describe, expect, it } from "vitest";
import { act, canUndo, current, newSession, replay, undo } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { fk } from "../helpers/game";

// Spec 6.2 : annulation Strict / Libre, rejeu d'une partie enregistrée.
describe("annulation", async () => {
  const catalog = await loadCatalog();
  const config = (undoMode: "strict" | "free") => ({ expansion: "FeudalKingdom", seed: 7, undoMode });

  function produceFirst(s: ReturnType<typeof newSession>) {
    const card = current(s).zones.play.find((id) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map(fk).includes(id));
    if (!card) throw new Error("aucune carte productive en jeu");
    return act(s, { type: "produce", card, choices: [0] });
  }

  it("Strict : on annule une action qui ne révèle rien", () => {
    let s = produceFirst(newSession(catalog, config("strict")));
    expect(canUndo(s)).toBe(true);
    const before = s.states[0];
    s = undo(s);
    expect(current(s)).toEqual(before);
  });

  it("Strict : impossible d'annuler une action qui révèle une carte (Avancer)", () => {
    const s = act(newSession(catalog, config("strict")), { type: "advance" });
    expect(canUndo(s)).toBe(false);
    expect(() => undo(s)).toThrow();
  });

  it("Libre : on peut tout annuler", () => {
    let s = act(newSession(catalog, config("free")), { type: "advance" });
    s = act(s, { type: "pass" });
    expect(canUndo(s)).toBe(true);
    s = undo(undo(s));
    expect(s.record.actions).toEqual([]);
  });

  it("rejouer l'enregistrement redonne exactement le même état", () => {
    let s = newSession(catalog, config("free"));
    s = act(produceFirst(s), { type: "advance" });
    s = act(s, { type: "pass" });
    const again = replay(catalog, JSON.parse(JSON.stringify(s.record)));
    expect(current(again)).toEqual(current(s));
  });
});

describe("annulation au-delà de la fenêtre gardée en mémoire", async () => {
  const catalog = await loadCatalog();

  it("Libre : rejoue l'enregistrement quand l'état précédent n'est plus en mémoire", async () => {
    const { UNDO_WINDOW, getLegalActions, resumeSession } = await import("../../src/engine");
    let s = newSession(catalog, { expansion: "FeudalKingdom", seed: 3, undoMode: "free" });
    for (let i = 0; i < UNDO_WINDOW + 5; i++) {
      const pass = getLegalActions(catalog, current(s)).find((a) => a.type === "pass") ?? getLegalActions(catalog, current(s))[0];
      if (!pass) break;
      s = act(s, pass);
    }
    expect(s.states.length).toBe(UNDO_WINDOW + 1);
    const expected = replay(catalog, { ...s.record, actions: s.record.actions.slice(0, -1) });
    const resumed = resumeSession(catalog, s.record, current(s));
    expect(current(undo(resumed))).toEqual(current(expected));
  });

  it("Strict : après une reprise, pas d'annulation", async () => {
    const { resumeSession } = await import("../../src/engine");
    const s = act(newSession(catalog, { expansion: "FeudalKingdom", seed: 3, undoMode: "strict" }), { type: "pass" });
    expect(canUndo(resumeSession(catalog, s.record, current(s)))).toBe(false);
  });
});
