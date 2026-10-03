import type { Stage, StageId } from "../data/schema";
import { instance, template } from "./state";
import type { Catalog, GameState, InstanceId } from "./types";

// Cases à cocher telles que l'interface les dessine (demande du 2026-10-03) : croix sur les cases cochées ; sur une
// piste à ordre imposé, la prochaine case libre est entourée d'un halo.

export type BoxView = { id: string; checked: boolean; next: boolean };

/** Effets qui laissent choisir la case (on touche la case voulue) : pas d'ordre imposé. */
const FREE_CHOICE = /^(Spend (\{\w+\})+ to )?mark 1(-2)? \{mark\}\.$|^Mark any 1 \{mark\}/i;

/** Les cases de cette étape se cochent-elles dans un ordre imposé ? (Export : cases atteintes, sans ordre) */
export function isOrderedTrack(stage: Stage): boolean {
  if (stage.checkboxes.length === 0 || stage.checkboxes.some((b) => b.threshold !== undefined)) return false;
  return !stage.effects.some((e) => FREE_CHOICE.test(e.text));
}

export function boxViews(catalog: Catalog, s: GameState, id: InstanceId, stageId: StageId): BoxView[] {
  const c = instance(s, id);
  const stage = template(catalog, c.templateId).stages[String(stageId) as "1"];
  if (!stage) return [];
  const checked = stage.checkboxes.map((b) => c.checkedBoxes.includes(`${stageId}/${b.id}`));
  const next = isOrderedTrack(stage) ? checked.indexOf(false) : -1;
  return stage.checkboxes.map((b, i) => ({ id: b.id, checked: checked[i] ?? false, next: i === next }));
}
