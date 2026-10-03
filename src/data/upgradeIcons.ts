import { z } from "zod";
import fkJson from "../../data/upgradeIcons/FeudalKingdom.json";
import type { StageId } from "./schema";

// Position des icônes de coût des améliorations, mesurée sur les images (scripts/upgrade-spots.ts) : [gauche, haut,
// largeur, hauteur] en fractions de la carte, l'étape lue à l'endroit, dans l'ordre du coût de la fiche.

export type IconRect = readonly [number, number, number, number];

const File = z.record(z.string(), z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])));
const files: Record<string, Record<string, IconRect[]>> = { FeudalKingdom: File.parse(fkJson) };

/** Icônes du coût d'une amélioration, ou undefined si elles n'ont pas été mesurées. */
export function costIconRects(expansion: string, serial: number, stage: StageId, upgrade: string): IconRect[] | undefined {
  return files[expansion]?.[`${serial}/${stage}/${upgrade}`];
}
