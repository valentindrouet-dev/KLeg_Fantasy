import { z } from "zod";
import frJson from "../../data/translations/FeudalKingdom.fr.json";
import type { StageId } from "./schema";

// Traductions françaises des cartes (affichage au survol). Fichier séparé des fiches : les fiches restent
// la donnée d'origine en anglais (spec section 0) ; ces textes ne servent qu'à l'aide à la lecture.

export const StageTranslationSchema = z.strictObject({ name: z.string(), text: z.string() });
export const TranslationsFileSchema = z.record(z.string(), z.record(z.string(), StageTranslationSchema));
export type StageTranslation = z.infer<typeof StageTranslationSchema>;

const fr = TranslationsFileSchema.parse(frJson);

export function stageFr(templateId: string, stage: StageId): StageTranslation | undefined {
  return fr[templateId]?.[String(stage)];
}
