import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { TranslationsFileSchema } from "../../src/data/translations";
import { readCardFiles, readResources } from "../../scripts/cardFiles";

// Traductions françaises : une par stage, mêmes icônes et mêmes nombres que le texte anglais.
describe("traductions françaises", async () => {
  const fr: Record<string, Record<string, { name: string; text: string }>> = {};
  for (const f of (await readdir("data/translations")).filter((x) => x.endsWith(".fr.json")))
    Object.assign(fr, TranslationsFileSchema.parse(JSON.parse(await readFile(`data/translations/${f}`, "utf8"))));
  const cards = (await readCardFiles("data/cards", await readResources())).flatMap((f) => (f.result.ok ? [f.result.card] : []));
  const tokens = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const numbers = (t: string) => [...t.replace(/\{\w+\}/g, "").matchAll(/\d+/g)].map((m) => m[0]).sort();

  it.each(cards.map((c) => [c.id, c] as const))("%s : chaque stage est traduit fidèlement", (_id, card) => {
    for (const [k, stage] of Object.entries(card.stages)) {
      const t = fr[card.id]?.[k];
      expect(t, `stage ${k}`).toBeDefined();
      if (!t || !stage) continue;
      expect(tokens(t.text)).toEqual(tokens(stage.text));
      for (const n of numbers(stage.text)) expect(numbers(t.text)).toContain(n);
      expect(t.name === "").toBe(stage.name === "");
    }
  });
});
