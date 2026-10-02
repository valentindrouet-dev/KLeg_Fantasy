import { z } from "zod";
import { StageIdSchema } from "./schema";

// Sortie brute du scraper (data/raw/{Expansion}/{n}.json) : uniquement ce que contient le HTML.
// Coûts, productions, gloire et flèches sont dans les images : voir docs/DATA_EXTRACTION.md.

export const RawKeywordSchema = z.strictObject({
  id: z.number().int().nullable(),
  name: z.string(),
  icon: z.string().nullable(),
  text: z.string(),
});

export const RawStageSchema = z.strictObject({
  stage: StageIdSchema,
  name: z.string(),
  namePlaceholder: z.boolean(), // "Card 01 Stage 2" : le site n'a pas le nom, il est dans l'image
  image: z.enum(["front", "back"]),
  description: z.string(),
  flavor: z.string(),
  keywords: z.array(RawKeywordSchema),
});
export type RawStage = z.infer<typeof RawStageSchema>;

export const RawCardSchema = z.strictObject({
  expansion: z.string(),
  serial: z.number().int(),
  url: z.string(),
  scrapedAt: z.string(),
  uuid: z.string().nullable(),
  variant: z.string().nullable(),
  title: z.string().nullable(),
  images: z.strictObject({ front: z.string().nullable(), back: z.string().nullable() }),
  // Stages présents sur chaque face, de haut (image à l'endroit) en bas (tête en bas).
  sides: z.strictObject({ front: z.array(StageIdSchema), back: z.array(StageIdSchema) }),
  description: z.string(),
  flavor: z.string(),
  stages: z.array(RawStageSchema),
});
export type RawCard = z.infer<typeof RawCardSchema>;
