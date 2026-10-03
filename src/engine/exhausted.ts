import type { Effect, StageId } from "../data/schema";
import { instance, template } from "./state";
import type { Catalog, GameState, InstanceId } from "./types";

// Effets épuisés (demande du 2026-10-03) : déjà utilisés s'ils ne servent qu'une fois, plus rien à découvrir (les
// cartes citées ont quitté la boîte), ou toutes les cases à cocher remplies. Ils ne sont plus proposés et l'interface
// les barre sur la carte.

/** Numéros des cartes qu'un effet fait découvrir : « Discover Mine (84 / 85) », « discover card 100 »… */
export function discoveredSerials(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/discover[^.()]*\(([\d\s/&]+)\)/gi)) out.push(...(m[1] ?? "").split(/[/&]/).map((n) => Number(n.trim())));
  for (const m of text.matchAll(/discover card (\d+)/gi)) out.push(Number(m[1]));
  return out.filter((n) => Number.isFinite(n) && n > 0);
}

export function isEffectExhausted(catalog: Catalog, s: GameState, id: InstanceId, stage: StageId, effect: Effect): boolean {
  const c = instance(s, id);
  if (c.crossedOutEffects.includes(`${stage}/${effect.id}`)) return true;
  // Découverte conditionnelle (« When complete, discover … ») ou avec une autre issue (« … or gain … ») : pas épuisée.
  const serials = /when complete|\bor gain\b/i.test(effect.text) ? [] : discoveredSerials(effect.text);
  if (serials.length) {
    const inBox = s.zones.box.some((b) => serials.includes(instance(s, b).serial));
    if (!inBox) return true;
  }
  if (effect.text.includes("{mark}")) {
    const boxes = template(catalog, c.templateId).stages[String(stage) as "1"]?.checkboxes ?? [];
    if (boxes.length && boxes.every((b) => c.checkedBoxes.includes(`${stage}/${b.id}`))) return true;
  }
  return false;
}

/** Effets épuisés d'un stage, avec leur identifiant et leur rang parmi les effets du stage (pour les barrer à leur place). */
export function exhaustedEffects(catalog: Catalog, s: GameState, id: InstanceId, stage: StageId): ExhaustedEffect[] {
  const effects = template(catalog, instance(s, id).templateId).stages[String(stage) as "1"]?.effects ?? [];
  return effects.flatMap((e, index) => (isEffectExhausted(catalog, s, id, stage, e) ? [{ id: e.id, index, count: effects.length }] : []));
}

export type ExhaustedEffect = { id: string; index: number; count: number };
