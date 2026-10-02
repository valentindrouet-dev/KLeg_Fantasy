import type { ProductionGroup, ResourceId } from "../data/schema";
import { activeStage, instance, stageIdAt, template } from "./state";
import type { Catalog, GameState, InstanceId, StickerPlacement } from "./types";

// Production d'une carte : groupes imprimés non rayés + stickers de ressource du stage actif.

export const MAX_PRODUCTION_FOR_STICKER = 9;

export function productionGroups(catalog: Catalog, s: GameState, id: InstanceId): ProductionGroup[] {
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  const c = instance(s, id);
  const printed = stage.production.filter((g) => !c.crossedOutProduction.includes(g.id));
  const stickers = c.stickers
    .filter((st) => st.stage === stage.id && st.resource !== undefined)
    .map((st, i): ProductionGroup => ({ id: `sticker${i}`, options: [[st.resource as ResourceId]] }));
  return [...printed, ...stickers];
}

/** Nombre de ressources produites (pour un « / », l'option la plus fournie). */
export function productionCount(catalog: Catalog, s: GameState, id: InstanceId): number {
  return productionGroups(catalog, s, id).reduce(
    (sum, g) => sum + Math.max(...g.options.map((o) => o.length)),
    0,
  );
}

/** Règle d'or 5 : pas de sticker de ressource sur une carte qui produit déjà 9 ou plus. */
export function canAddResourceSticker(catalog: Catalog, s: GameState, id: InstanceId): boolean {
  return productionCount(catalog, s, id) < MAX_PRODUCTION_FOR_STICKER;
}

/**
 * Pose un sticker de ressource sur le stage actif. Renvoie false (effet ignoré) si la règle d'or 5 l'interdit.
 * La disponibilité des stickers (catalogue) arrive en P3.
 */
export function addResourceSticker(
  catalog: Catalog,
  s: GameState,
  id: InstanceId,
  sticker: string,
  resource: ResourceId,
): boolean {
  if (!canAddResourceSticker(catalog, s, id)) return false;
  const c = instance(s, id);
  const stageId = stageIdAt(template(catalog, c.templateId), c.orientation);
  if (stageId === null) return false;
  const placement: StickerPlacement = { sticker, stage: stageId, resource };
  c.stickers.push(placement);
  return true;
}

/** Toutes les combinaisons de choix (un indice d'option par groupe). */
export function productionChoices(groups: readonly ProductionGroup[]): number[][] {
  return groups.reduce<number[][]>(
    (acc, g) => acc.flatMap((prefix) => g.options.map((_, i) => [...prefix, i])),
    [[]],
  );
}

export function producedIcons(groups: readonly ProductionGroup[], choices: readonly number[]): ResourceId[] {
  return groups.flatMap((g, i) => g.options[choices[i] ?? 0] ?? []);
}
