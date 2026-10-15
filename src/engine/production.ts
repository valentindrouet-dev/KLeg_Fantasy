import type { ProductionGroup, ResourceId } from "../data/schema";
import { activeStage, hasKeyword, instance, keywordsOf, stageIdAt, template } from "./state";
import { coinMalus, productionBonus, surplusActive } from "./passives";
import type { Catalog, GameState, InstanceId, StickerPlacement } from "./types";

// Production d'une carte : groupes imprimés non rayés + stickers de ressource du stage actif.

export const MAX_PRODUCTION_FOR_STICKER = 9;

export function productionGroups(catalog: Catalog, s: GameState, id: InstanceId): ProductionGroup[] {
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  const c = instance(s, id);
  // Icônes rayées (Manor, Attack…) : clé `${stage}/${groupe}/${indice}`, retirées de chaque option du groupe ; une icône
  // précise (« cross out 1 {coin} production ») : clé `${stage}/${groupe}/o${option}i${icône}`.
  const printed = stage.production.flatMap((g): ProductionGroup[] => {
    const crossed = truncatedCount(c.crossedOutProduction, stage.id, g.id);
    const exact = exactCrossings(c.crossedOutProduction, stage.id, g.id);
    if (crossed === 0 && exact.length === 0) return [g];
    const options = g.options
      .map((o, oi) => o.filter((_, i) => !exact.some((x) => x.option === oi && x.icon === i)))
      .map((o) => o.slice(0, Math.max(0, o.length - crossed)))
      .filter((o) => o.length > 0);
    return options.length ? [{ id: g.id, options }] : [];
  });
  const stickers = c.stickers
    .filter((st) => st.stage === stage.id && st.resource !== undefined)
    .map((st, i): ProductionGroup => ({ id: `sticker${i}`, options: [[st.resource as ResourceId]] }));
  const bonus = productionBonus(catalog, s, id).map((o, i): ProductionGroup => ({ id: `bonus${i}`, options: [o] }));
  const own = [...printed, ...stickers, ...bonus];
  // Wheel of Fortune (Adventures) : production double si la carte partage un mot-clé avec la carte bloquée.
  const all = wheelDoubles(catalog, s, id) ? [...own, ...own.map((g): ProductionGroup => ({ id: `${g.id}x2`, options: g.options }))] : own;
  const groups = withoutCoins(all, coinMalus(catalog, s));
  return surplusActive(catalog, s) && hasKeyword(catalog, s, id, "Land") ? groups.map(withSurplus) : groups;
}

export const WHEEL_TEXT = "All cards sharing any keyword with the blocked card have double production.";

function wheelDoubles(catalog: Catalog, s: GameState, id: InstanceId): boolean {
  const mine = keywordsOf(catalog, s, id).map((k) => k.toLowerCase());
  if (mine.length === 0) return false;
  return s.zones.play.some((w) => {
    const stage = activeStage(catalog, s, w);
    if (!stage?.effects.some((e) => e.text === WHEEL_TEXT)) return false;
    return (s.blocks?.[w] ?? []).some((b) => keywordsOf(catalog, s, b).some((k) => mine.includes(k.toLowerCase())));
  });
}

/** Surplus : chaque {coin} d'une terre peut devenir {tradeGood} ; options dédoublonnées. */
function withSurplus(g: ProductionGroup): ProductionGroup {
  const seen = new Set<string>();
  const options: ResourceId[][] = [];
  for (const o of g.options) {
    const coins = o.filter((r) => r === "coin").length;
    const rest = o.filter((r) => r !== "coin");
    for (let k = 0; k <= coins; k++) {
      const opt = [...rest, ...Array.from({ length: coins - k }, (): ResourceId => "coin"), ...Array.from({ length: k }, (): ResourceId => "tradeGood")];
      const key = [...opt].sort().join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(opt);
    }
  }
  return { id: g.id, options };
}

/** Retire `n` icônes {coin} de la production (Pirate) : une par passage, dans le premier groupe qui en a. */
function withoutCoins(groups: ProductionGroup[], n: number): ProductionGroup[] {
  let out = groups;
  for (let k = 0; k < n; k++) {
    const i = out.findIndex((g) => g.options.some((o) => o.includes("coin")));
    if (i < 0) break;
    const g = out[i] as ProductionGroup;
    const options = g.options
      .map((o) => {
        const j = o.indexOf("coin");
        return j < 0 ? o : [...o.slice(0, j), ...o.slice(j + 1)];
      })
      .filter((o) => o.length > 0);
    out = options.length ? out.map((x, idx) => (idx === i ? { id: g.id, options } : x)) : out.filter((_, idx) => idx !== i);
  }
  return out;
}

/** Rayures « en fin de groupe » (clé à indice simple) d'un groupe de production. */
export function truncatedCount(keys: readonly string[], stage: number, group: string): number {
  return keys.filter((k) => new RegExp(`^${stage}/${group}/\\d+$`).test(k)).length;
}

/** Icônes rayées précisément (clé `…/o${option}i${icône}`) d'un groupe de production. */
export function exactCrossings(keys: readonly string[], stage: number, group: string): { option: number; icon: number }[] {
  return keys.flatMap((k) => {
    const m = new RegExp(`^${stage}/${group}/o(\\d+)i(\\d+)$`).exec(k);
    return m ? [{ option: Number(m[1]), icon: Number(m[2]) }] : [];
  });
}

/** Raye une icône de production du stage actif (« cross out 1 production ») ; false s'il n'y en a plus. */
export function crossOutProduction(catalog: Catalog, s: GameState, id: InstanceId, groupId?: string): boolean {
  const stage = activeStage(catalog, s, id);
  if (!stage) return false;
  const c = instance(s, id);
  const groups = stage.production.filter((g) => groupId === undefined || g.id === groupId);
  for (const g of groups) {
    const crossed = truncatedCount(c.crossedOutProduction, stage.id, g.id);
    const exact = exactCrossings(c.crossedOutProduction, stage.id, g.id).length;
    const size = Math.max(...g.options.map((o) => o.length));
    if (crossed + exact < size) {
      c.crossedOutProduction.push(`${stage.id}/${g.id}/${crossed}`);
      return true;
    }
  }
  return false;
}

/** Icônes imprimées d'une ressource encore visibles sur le stage actif (pour en rayer une précisément). */
export function crossableIcons(catalog: Catalog, s: GameState, id: InstanceId, resource?: ResourceId): { key: string; resource: ResourceId }[] {
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  const c = instance(s, id);
  return stage.production.flatMap((g) => {
    const crossed = truncatedCount(c.crossedOutProduction, stage.id, g.id);
    const exact = exactCrossings(c.crossedOutProduction, stage.id, g.id);
    return g.options.flatMap((o, oi) => {
      const visible = o.map((r, i) => ({ r, i })).filter(({ i }) => !exact.some((x) => x.option === oi && x.icon === i));
      return visible
        .slice(0, Math.max(0, visible.length - crossed))
        .filter(({ r }) => resource === undefined || r === resource)
        .map(({ r, i }) => ({ key: `${stage.id}/${g.id}/o${oi}i${i}`, resource: r }));
    });
  });
}

/** Raye précisément une icône d'une ressource (la dernière visible de cette ressource) ; false s'il n'y en a pas. */
export function crossOutIcon(catalog: Catalog, s: GameState, id: InstanceId, resource: ResourceId): boolean {
  const icon = crossableIcons(catalog, s, id, resource).at(-1);
  if (!icon) return false;
  instance(s, id).crossedOutProduction.push(icon.key);
  return true;
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
