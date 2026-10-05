import { z } from "zod";
import fkJson from "../../data/fameIcons/FeudalKingdom.json";
import type { StageId } from "./schema";

// Icône de gloire « * » des étapes à gloire variable, mesurée sur les images (scripts/fame-spots.ts) : [centre x,
// centre y, diamètre] en fractions de la carte (x et diamètre : largeur ; y : hauteur), l'étape lue à l'endroit.

export type FameSpot = readonly [number, number, number];

const File = z.record(z.string(), z.tuple([z.number(), z.number(), z.number()]));
const files: Record<string, Record<string, FameSpot>> = { FeudalKingdom: File.parse(fkJson) };

/** Icône « * » d'une étape, ou undefined (pas de rosette : Army, Treasury…, ou pas mesurée). */
export function fameSpot(expansion: string, serial: number, stage: StageId): FameSpot | undefined {
  return files[expansion]?.[`${serial}/${stage}`];
}
