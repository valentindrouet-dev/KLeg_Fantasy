import { activeStage, hasKeyword, instance } from "../state";
import type { Draft, InstanceId } from "../types";
import { effectKey } from "./registry";

// Impregnable Fortress : « You may discard 2 Walls instead of this. » Quand la forteresse se défausse pour
// son action (production, effet), le joueur peut défausser 2 murs en jeu à la place (effects/cards.ts).

export const FORTRESS_TEXT = "You may discard 2 Walls instead of this.";

const WALL = /\bWall\b/;

/**
 * Script à lancer à la place de la défausse de la carte, ou null. Production d'une carte noble (Adventures) : Prydwen
 * en jeu peut être défaussée à sa place.
 */
export function substituteScript(d: Draft, card: InstanceId, reason: "produce" | "effect" = "effect"): string | null {
  const prydwen = reason === "produce" ? prydwenScript(d, card) : null;
  if (prydwen) return prydwen;
  const stage = activeStage(d.catalog, d.s, card);
  const effect = stage?.effects.find((e) => e.text === FORTRESS_TEXT);
  if (!stage || !effect || instance(d.s, card).crossedOutEffects.includes(`${stage.id}/${effect.id}`)) return null;
  const walls = d.s.zones.play.filter((id) => id !== card && WALL.test(activeStage(d.catalog, d.s, id)?.name ?? ""));
  return walls.length >= 2 ? effectKey(instance(d.s, card).templateId, stage.id, effect.id) : null;
}

/** Prydwen (Adventures) en jeu : la carte noble qui produit peut rester en jeu, Prydwen est défaussée à sa place. */
const PRYDWEN_TEXT = "When you produce with a noble card, discard this instead.";
function prydwenScript(d: Draft, card: InstanceId): string | null {
  if (!hasKeyword(d.catalog, d.s, card, "Noble")) return null;
  for (const p of d.s.zones.play) {
    const stage = activeStage(d.catalog, d.s, p);
    const e = stage?.effects.find((x) => x.text === PRYDWEN_TEXT);
    if (p !== card && stage && e && stage.name === "Prydwen") return effectKey(instance(d.s, p).templateId, stage.id, e.id);
  }
  return null;
}
