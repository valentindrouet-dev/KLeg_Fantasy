import { describe, expect, it } from "vitest";
import { effectLines } from "../../src/data/textLines";
import { discoveredSerials } from "../../src/engine/exhausted";
import { isFullImageFace } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import type { StageId } from "../../src/data/schema";

// Lignes de texte mesurées sur les images (scripts/text-lines.ts) : un effet qui peut s'épuiser doit pouvoir être
// barré ligne par ligne.
describe("lignes de texte des effets", async () => {
  const catalog = await loadCatalog();
  const effects = [...catalog.templates.values()].flatMap((t) =>
    Object.values(t.stages).flatMap((st) => (st ? st.effects.map((e) => ({ t, stage: st.id as StageId, e })) : [])),
  );

  it("chaque effet qui découvre une carte ou coche des cases a ses lignes", () => {
    const exhaustible = effects.filter(({ e }) => discoveredSerials(e.text).length > 0 || e.text.includes("{mark}"));
    const missing = exhaustible.filter(({ t, stage, e }) => !effectLines(t.expansion, t.serial, stage, e.id)?.length);
    expect(missing.map(({ t, stage, e }) => `${t.serial}/${stage}/${e.id}`)).toEqual([]);
  });

  it("les lignes sont dans la carte, de haut en bas, et dans la bonne moitié", () => {
    for (const { t, stage, e } of effects) {
      const lines = effectLines(t.expansion, t.serial, stage, e.id) ?? [];
      // Face qui porte cette étape : à image pleine, le texte est en bas ; sinon dans la moitié de l'étape.
      const full = (["front", "back"] as const).some((side) => isFullImageFace(t, side) && [t.orientationToStage[`${side}-0`], t.orientationToStage[`${side}-180`]].includes(stage));
      lines.forEach(([top, bottom, left, right], i) => {
        expect(top).toBeLessThan(bottom);
        expect(left).toBeLessThan(right);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(right).toBeLessThanOrEqual(1);
        if (!full) expect(bottom).toBeLessThanOrEqual(0.5);
        if (i > 0) expect(top).toBeGreaterThan(lines[i - 1]?.[0] ?? 0);
      });
    }
  });

  it("Mason (43) : l'effet du recto est sur ses deux lignes, en bas de l'image", () => {
    const lines = effectLines("FeudalKingdom", 43, 1, "e1") ?? [];
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l[0]).toBeGreaterThan(0.7);
  });
});
