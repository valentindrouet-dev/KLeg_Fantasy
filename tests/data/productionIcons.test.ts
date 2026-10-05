import { describe, expect, it } from "vitest";
import { productionIconRects } from "../../src/data/productionIcons";
import { loadCatalog } from "../helpers/catalog";

// Icônes de production mesurées (scripts/production-spots.ts) : une position par icône imprimée de chaque étape qui
// produit, pour dessiner la croix d'une production rayée.
const INTEGRATED = ["FeudalKingdom", "Merchants"];

describe("icônes de production mesurées", async () => {
  const catalog = await loadCatalog();
  it("chaque étape qui produit a une position par icône imprimée, dans la carte", () => {
    const wrong: string[] = [];
    for (const t of catalog.templates.values()) {
      if (!INTEGRATED.includes(t.expansion)) continue;
      for (const [k, stage] of Object.entries(t.stages)) {
        if (!stage?.production.length) continue;
        const icons = stage.production.reduce((n, g) => n + g.options.reduce((m, o) => m + o.length, 0), 0);
        const rects = productionIconRects(t.expansion, t.serial, Number(k) as 1) ?? [];
        const inside = rects.every(([x, y, w, h]) => x >= 0 && y >= 0 && x + w <= 1 && y + h <= 1);
        if (rects.length !== icons || !inside) wrong.push(`${t.expansion} ${t.serial}/${k} : ${rects.length}/${icons}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
