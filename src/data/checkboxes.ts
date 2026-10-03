import { z } from "zod";
import fkJson from "../../data/checkboxes/FeudalKingdom.json";
import type { StageId } from "./schema";

// Position des cases à cocher de chaque étape, mesurée sur les images (scripts/checkbox-spots.ts) : [gauche, haut,
// largeur, hauteur] en fractions de la carte, l'étape lue à l'endroit, dans l'ordre des cases de la fiche.

export type BoxRect = readonly [number, number, number, number];

const BoxesFileSchema = z.record(z.string(), z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])));

const files: Record<string, Record<string, BoxRect[]>> = {
  FeudalKingdom: BoxesFileSchema.parse(fkJson),
};

/** Cases d'une étape, ou undefined si elles n'ont pas été mesurées. */
export function boxRects(expansion: string, serial: number, stage: StageId): BoxRect[] | undefined {
  return files[expansion]?.[`${serial}/${stage}`];
}
