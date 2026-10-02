import type { Category } from "../../data/schema";
import { activeStage, instance, productionGroups, staysInPlay, type Catalog, type GameState, type InstanceId } from "../../engine";

// Ordre d'affichage des cartes en jeu (demande du 2026-10-02) : par ressource produite, ou par type de carte.
// Purement visuel : l'ordre du moteur (ordre d'arrivée) ne change pas.

export type SortMode = "resources" | "type" | "arrival";

const CATEGORY_ORDER: Category[] = ["land", "building", "person", "livestock", "seafaring", "other", "goal", "negative", "none"];

function resourceKey(catalog: Catalog, s: GameState, id: InstanceId): number {
  const first = productionGroups(catalog, s, id)[0]?.options[0]?.[0];
  const i = first ? catalog.resources.indexOf(first) : -1;
  return i >= 0 ? i : catalog.resources.length;
}

function typeKey(catalog: Catalog, s: GameState, id: InstanceId): number {
  const c = activeStage(catalog, s, id)?.category;
  const i = c ? CATEGORY_ORDER.indexOf(c) : -1;
  return i >= 0 ? i : CATEGORY_ORDER.length;
}

const isEnemy = (catalog: Catalog, s: GameState, id: InstanceId): boolean => activeStage(catalog, s, id)?.keywords.includes("Enemy") ?? false;

/**
 * Disposition de la zone de jeu : en haut les ennemis, puis (un peu à l'écart) les cartes qui restent en jeu ;
 * dessous les autres cartes, triées.
 */
export type PlayLayout = { enemies: InstanceId[]; stays: InstanceId[]; others: InstanceId[] };

export function playLayout(catalog: Catalog, s: GameState, ids: readonly InstanceId[], mode: SortMode): PlayLayout {
  const sorted = sortPlay(catalog, s, ids, mode);
  const enemies = sorted.filter((id) => isEnemy(catalog, s, id));
  const stays = sorted.filter((id) => !isEnemy(catalog, s, id) && staysInPlay({ catalog, s }, id));
  return { enemies, stays, others: sorted.filter((id) => !enemies.includes(id) && !stays.includes(id)) };
}

export function sortPlay(catalog: Catalog, s: GameState, ids: readonly InstanceId[], mode: SortMode): InstanceId[] {
  if (mode === "arrival") return [...ids];
  const keys = (id: InstanceId): number[] => {
    const r = resourceKey(catalog, s, id);
    const t = typeKey(catalog, s, id);
    return [...(mode === "resources" ? [r, t] : [t, r]), instance(s, id).serial];
  };
  return [...ids].sort((a, b) => {
    const ka = keys(a);
    const kb = keys(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return (ka[i] ?? 0) - (kb[i] ?? 0);
    return 0;
  });
}
