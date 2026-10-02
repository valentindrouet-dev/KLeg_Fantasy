import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { act, current, newSession } from "../../src/engine";
import { deleteKingdom, duplicateKingdom, getKingdom, listKingdoms, saveKingdom } from "../../src/persistence/db";
import { newKingdomId, randomKingdomName, summarize, type Kingdom } from "../../src/persistence/kingdoms";
import { loadCatalog } from "../helpers/catalog";

// Spec 6 : royaumes indépendants, sauvegarde, duplication, suppression.
describe("royaumes", async () => {
  const catalog = await loadCatalog();

  function kingdom(seed: number, name: string): Kingdom {
    let s = newSession(catalog, { expansion: "FeudalKingdom", seed, undoMode: "free" });
    s = act(s, { type: "pass" });
    const now = Date.now();
    return {
      id: newKingdomId(),
      name,
      emoji: "🏰",
      createdAt: now,
      updatedAt: now + seed,
      summary: summarize(catalog, s.record, current(s)),
      record: s.record,
      state: current(s),
    };
  }

  it("sauvegarde et relit un royaume à l'identique", async () => {
    const k = kingdom(1, "Vallombre");
    await saveKingdom(k);
    expect(await getKingdom(k.id)).toEqual(k);
  });

  it("liste par dernière partie, duplique et supprime sans toucher aux autres", async () => {
    const a = kingdom(10, "A");
    const b = kingdom(20, "B");
    await saveKingdom(a);
    await saveKingdom(b);
    const copy = await duplicateKingdom(a.id);
    expect(copy?.name).toBe("A (copie)");
    expect(copy?.record).toEqual(a.record);
    await deleteKingdom(a.id);
    const names = (await listKingdoms()).map((k) => k.name);
    expect(names).toContain("B");
    expect(names).toContain("A (copie)");
    expect(names).not.toContain("A");
  });

  it("résume l'état : manche, gloire, statut", () => {
    const k = kingdom(1, "X");
    expect(k.summary).toMatchObject({ round: 1, turn: 2, status: "playing", actions: 1, lastDiscovered: null });
  });

  it("propose des noms aléatoires", () => {
    expect(randomKingdomName(() => 0)).toBe("Valombre");
  });
});
