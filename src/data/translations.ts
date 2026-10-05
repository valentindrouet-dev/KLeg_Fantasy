/// <reference types="vite/client" />
import { z } from "zod";
import type { StageId } from "./schema";

// Traductions françaises des cartes (affichage au survol). Fichier séparé des fiches : les fiches restent
// la donnée d'origine en anglais (spec section 0) ; ces textes ne servent qu'à l'aide à la lecture.

export const StageTranslationSchema = z.strictObject({ name: z.string(), text: z.string() });
export const TranslationsFileSchema = z.record(z.string(), z.record(z.string(), StageTranslationSchema));
export type StageTranslation = z.infer<typeof StageTranslationSchema>;

// Un fichier par extension (data/translations/<Extension>.fr.json), tous fusionnés.
const files = import.meta.glob<unknown>("/data/translations/*.fr.json", { eager: true, import: "default" });
const fr = Object.assign({}, ...Object.values(files).map((f) => TranslationsFileSchema.parse(f))) as z.infer<typeof TranslationsFileSchema>;

export function stageFr(templateId: string, stage: StageId): StageTranslation | undefined {
  return fr[templateId]?.[String(stage)];
}
