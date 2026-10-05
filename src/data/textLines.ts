import { z } from "zod";
import fkJson from "../../data/textLines/FeudalKingdom.json";
import merchantsJson from "../../data/textLines/Merchants.json";
import type { StageId } from "./schema";

// Lignes de texte des effets, mesurées sur les images (scripts/text-lines.ts) : [haut, bas, gauche, droite] en
// fractions de la carte, l'étape lue à l'endroit. Sert à barrer un effet épuisé ligne par ligne.

export type TextLine = readonly [number, number, number, number];

const LinesFileSchema = z.record(z.string(), z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])));

const files: Record<string, Record<string, TextLine[]>> = {
  FeudalKingdom: LinesFileSchema.parse(fkJson),
  Merchants: LinesFileSchema.parse(merchantsJson),
};

/** Lignes d'un effet, ou undefined si elles n'ont pas été mesurées. */
export function effectLines(expansion: string, serial: number, stage: StageId, effect: string): TextLine[] | undefined {
  return files[expansion]?.[`${serial}/${stage}/${effect}`];
}
