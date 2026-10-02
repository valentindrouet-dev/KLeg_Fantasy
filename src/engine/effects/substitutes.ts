import { activeStage, instance } from "../state";
import type { Draft, InstanceId } from "../types";
import { effectKey } from "./registry";

// Impregnable Fortress : « You may discard 2 Walls instead of this. » Quand la forteresse se défausse pour
// son action (production, effet), le joueur peut défausser 2 murs en jeu à la place (effects/cards.ts).

export const FORTRESS_TEXT = "You may discard 2 Walls instead of this.";

const WALL = /\bWall\b/;

/** Script à lancer à la place de la défausse de la carte, ou null. */
export function substituteScript(d: Draft, card: InstanceId): string | null {
  const stage = activeStage(d.catalog, d.s, card);
  const effect = stage?.effects.find((e) => e.text === FORTRESS_TEXT);
  if (!stage || !effect || instance(d.s, card).crossedOutEffects.includes(`${stage.id}/${effect.id}`)) return null;
  const walls = d.s.zones.play.filter((id) => id !== card && WALL.test(activeStage(d.catalog, d.s, id)?.name ?? ""));
  return walls.length >= 2 ? effectKey(instance(d.s, card).templateId, stage.id, effect.id) : null;
}
