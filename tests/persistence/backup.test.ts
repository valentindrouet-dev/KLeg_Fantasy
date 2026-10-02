import { describe, expect, it } from "vitest";
import { act, current, getLegalActions, newSession } from "../../src/engine";
import { exportKingdom, importKingdom } from "../../src/persistence/backup";
import { summarize, type Kingdom } from "../../src/persistence/kingdoms";
import { loadCatalog } from "../helpers/catalog";

// Spec 6.2 : export / import d'un royaume.
describe("sauvegarde d'un royaume", async () => {
  const catalog = await loadCatalog();

  function kingdom(): Kingdom {
    let s = newSession(catalog, { expansion: "FeudalKingdom", seed: 5, undoMode: "free" });
    for (let i = 0; i < 12; i++) {
      const a = getLegalActions(catalog, current(s))[0];
      if (a) s = act(s, a);
    }
    return { id: "k-test", name: "Vallombre", emoji: "🏰", createdAt: 1, updatedAt: 2, summary: summarize(catalog, s.record, current(s)), record: s.record, state: current(s) };
  }

  it("exporte puis réimporte la même partie (état rejoué identique)", () => {
    const k = kingdom();
    const back = importKingdom(catalog, exportKingdom(k, "v0.13"), []);
    expect(back.id).toBe("k-test");
    expect(back.record).toEqual(k.record);
    expect(back.state).toEqual(k.state);
  });

  it("garde les deux royaumes si l'identifiant existe déjà", () => {
    const back = importKingdom(catalog, exportKingdom(kingdom(), "v0.13"), ["k-test"]);
    expect(back.id).not.toBe("k-test");
    expect(back.name).toBe("Vallombre (importé)");
  });

  it("refuse un fichier qui n'est pas une sauvegarde", () => {
    expect(() => importKingdom(catalog, "{}", [])).toThrow("n'est pas une sauvegarde");
    expect(() => importKingdom(catalog, "pas du json", [])).toThrow("JSON illisible");
  });

  it("refuse une partie qui ne se rejoue pas", () => {
    const data = JSON.parse(exportKingdom(kingdom(), "v0.13")) as { kingdom: { record: { actions: unknown[] } } };
    data.kingdom.record.actions[0] = { type: "upgrade", card: "FeudalKingdom-001", upgrade: "u1", discard: [] };
    expect(() => importKingdom(catalog, JSON.stringify(data), [])).toThrow("ne peut pas être rejouée");
  });
});
