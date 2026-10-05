import { z } from "zod";
import fkJson from "../../data/productionIcons/FeudalKingdom.json";
import merchantsJson from "../../data/productionIcons/Merchants.json";
import type { StageId } from "./schema";

// Position des icônes de production de chaque étape, mesurée sur les images (scripts/production-spots.ts) : [gauche,
// haut, largeur, hauteur] en fractions de la carte, l'étape lue à l'endroit, dans l'ordre de la fiche (groupe, option,
// icône). Sert à dessiner la croix d'une production rayée (Royal Decree, Attack, Grapes…).

export type IconRect = readonly [number, number, number, number];

const File = z.record(z.string(), z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])));
const files: Record<string, Record<string, IconRect[]>> = { FeudalKingdom: File.parse(fkJson), Merchants: File.parse(merchantsJson) };

/** Icônes de production d'une étape, ou undefined si elles n'ont pas été mesurées. */
export function productionIconRects(expansion: string, serial: number, stage: StageId): IconRect[] | undefined {
  return files[expansion]?.[`${serial}/${stage}`];
}
