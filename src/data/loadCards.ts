import resourcesJson from "../../data/resources.json";
import expansionsJson from "../../data/expansions.json";
import { ExpansionsFileSchema, ResourcesFileSchema, type ExpansionDef, type ResourceDef } from "./schema";
import { parseCard, type CardParseResult } from "./validate";

// Chargement côté navigateur. Les fiches sont découpées par extension et chargées à la demande ;
// les images WebP sont résolues en URL par Vite (hash de cache inclus).

const cardModules = {
  ...import.meta.glob<unknown>("/data/cards/*/*.json", { import: "default" }),
  ...import.meta.glob<unknown>("/data/custom/*/*.json", { import: "default" }),
};

const imageUrls = import.meta.glob<string>("/data/images/*/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export const resources: readonly ResourceDef[] = ResourcesFileSchema.parse(resourcesJson).resources;
export const expansions: readonly ExpansionDef[] = ExpansionsFileSchema.parse(expansionsJson).expansions;

export type LoadedCard = { file: string; serial: number; result: CardParseResult };

function expansionOf(file: string): string {
  return file.split("/").at(-2) ?? "";
}

function serialOf(file: string): number {
  return Number.parseInt(file.split("/").at(-1) ?? "", 10);
}

/** Extensions pour lesquelles au moins une fiche existe. */
export function availableExpansions(): string[] {
  return [...new Set(Object.keys(cardModules).map(expansionOf))].sort();
}

export async function loadExpansion(expansion: string): Promise<LoadedCard[]> {
  const files = Object.keys(cardModules).filter((f) => expansionOf(f) === expansion);
  const loaded = await Promise.all(
    files.map(async (file): Promise<LoadedCard> => {
      const json = await cardModules[file]?.();
      return { file, serial: serialOf(file), result: parseCard(json, resources) };
    }),
  );
  return loaded.sort((a, b) => a.serial - b.serial);
}

/** URL d'une image de carte, `undefined` si le WebP n'a pas encore été généré. */
export function cardImageUrl(relativePath: string): string | undefined {
  return imageUrls[`/data/images/${relativePath}`];
}
