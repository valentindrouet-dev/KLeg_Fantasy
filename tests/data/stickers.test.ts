import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { StickersFileSchema } from "../../src/data/schema";
import { readCardFiles, readResources } from "../../scripts/cardFiles";

// Spec 3.6 : catalogue des stickers, recoupé avec les numéros cités par les cartes.
describe("catalogue des stickers", async () => {
  const file = StickersFileSchema.parse(JSON.parse(await readFile("data/stickers.json", "utf8")));
  const resources = await readResources();
  const cards = await readCardFiles("data/cards", resources);

  it("a des identifiants uniques et des ressources connues", () => {
    const ids = file.stickers.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of file.stickers.filter((x) => x.type === "resource")) {
      expect(resources.map((r) => r.id)).toContain(s.resource);
    }
  });

  it("les stickers de ressource 1 à 6 suivent l'ordre des cartes (« numbered 1-6 »)", () => {
    const order = ["coin", "wood", "stone", "metal", "sword", "tradeGood"];
    order.forEach((r, i) => expect(file.stickers.find((s) => s.id === String(i + 1))?.resource).toBe(r));
  });

  it("chaque sticker cité par une carte de Feudal Kingdom ou de Merchants existe", () => {
    const cited = new Set<string>();
    for (const f of cards) {
      if (!f.result.ok || !["FeudalKingdom", "Merchants"].includes(f.result.card.expansion)) continue;
      for (const st of Object.values(f.result.card.stages)) {
        for (const m of (st?.text ?? "").matchAll(/[Ss]ticker ((?:\d+[a-z]?(?:\s*(?:\/|&|and)\s*)?)+)/g)) {
          for (const id of (m[1] ?? "").split(/\s*(?:\/|&|and)\s*/)) if (id) cited.add(id.trim());
        }
      }
    }
    const known = file.stickers.map((s) => s.id);
    expect([...cited].filter((id) => !known.includes(id))).toEqual([]);
    expect(cited.size).toBeGreaterThan(5);
  });
});
