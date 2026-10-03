import { describe, expect, it } from "vitest";
import { boxRects } from "../../src/data/checkboxes";
import { loadCatalog } from "../helpers/catalog";

// Positions des cases mesurées sur les images (scripts/checkbox-spots.ts) : une par case de la fiche, dans la carte.
describe("positions des cases à cocher", async () => {
  const catalog = await loadCatalog();
  it("chaque étape à cases a autant de positions que de cases, dans la carte", () => {
    const wrong: string[] = [];
    for (const t of catalog.templates.values()) {
      for (const st of Object.values(t.stages)) {
        if (!st || st.checkboxes.length === 0) continue;
        const rects = boxRects(t.expansion, t.serial, st.id) ?? [];
        if (rects.length !== st.checkboxes.length) wrong.push(`${t.serial}/${st.id} : ${rects.length}/${st.checkboxes.length}`);
        for (const [x, y, w, h] of rects) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + w).toBeLessThanOrEqual(1);
          expect(y + h).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
