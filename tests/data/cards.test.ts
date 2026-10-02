import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readCardFiles, readResources } from "../../scripts/cardFiles";

// Spec section 10 : toutes les cartes de ./data/cards passent le schéma Zod.
describe("données des cartes", async () => {
  const resources = await readResources();
  const roots = ["data/cards", "data/custom"].filter((r) => existsSync(r));
  const files = (await Promise.all(roots.map((r) => readCardFiles(r, resources)))).flat();

  it("trouve des fiches de cartes", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.file, f] as const))("%s est valide et cohérente", (_file, f) => {
    expect(f.result.issues).toEqual([]);
    expect(f.result.ok).toBe(true);
  });

  it("n'a pas deux fiches avec le même id", () => {
    const ids = files.flatMap((f) => (f.result.ok ? [f.result.card.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
