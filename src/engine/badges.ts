import { staysInPlay } from "./flow";
import { activeStage, instance, template } from "./state";
import type { Catalog, GameState, InstanceId } from "./types";

// Ce qu'on ne voit pas sur l'image d'une carte : cases cochées ou palier suivant, compteur, gloire écrite.
// Les stickers sont dessinés sur la carte (CardView).

export function cardBadges(catalog: Catalog, s: GameState, id: InstanceId): string[] {
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  const c = instance(s, id);
  const out: string[] = [];
  const boxes = template(catalog, c.templateId).stages[String(stage.id) as "1"]?.checkboxes ?? [];
  const next = boxes.find((b) => !c.checkedBoxes.includes(`${stage.id}/${b.id}`));
  const tally = c.tallies?.[String(stage.id)] ?? 0;
  if (next?.threshold !== undefined) {
    // Export : marchandises dépensées / palier suivant.
    out.push(`{tradeGood} ${tally}/${next.threshold}`);
  } else if (next?.cost?.length) {
    // Piste (Army, Treasury…) : ce qu'il faut dépenser pour cocher la case suivante, et sa gloire.
    const r = next.cost[0] ?? "";
    const same = next.cost.every((x) => x === r);
    const cost = same ? `${next.cost.length}{${r}}` : next.cost.map((x) => `{${x}}`).join("");
    out.push(next.fame !== undefined ? `${cost} → {fame}${next.fame}` : cost);
  } else if (boxes.length) {
    out.push(`☑ ${boxes.filter((b) => c.checkedBoxes.includes(`${stage.id}/${b.id}`)).length}/${boxes.length}`);
  } else if (tally) out.push(`{tradeGood} ${tally}`);
  const written = Object.entries(c.written ?? {}).filter(([k]) => k.startsWith(`${stage.id}/`)).reduce((sum, [, n]) => sum + n, 0);
  if (written) out.push(`✎ {fame}${written}`);
  return out;
}

/** Texte d'un effet qui peut changer l'orientation de sa propre carte. */
const TURNS_ITSELF = /\{rotate\}|\{flip\}|\breset\b|rotate this card|Undiscover/i;

/**
 * Carte en jeu qu'on peut montrer en demi-carte (demande du 2026-10-02) : elle reste en jeu, ou elle est à son
 * dernier stage (aucune amélioration, aucun effet qui la tourne). Jamais une carte à une étape par face (image pleine),
 * dont le texte est en bas.
 */
export function showsTopHalfOnly(catalog: Catalog, s: GameState, id: InstanceId): boolean {
  const stage = activeStage(catalog, s, id);
  if (!stage || !s.zones.play.includes(id)) return false;
  const used = Object.values(template(catalog, instance(s, id).templateId).orientationToStage);
  if (!used.includes(2) && !used.includes(3)) return false;
  if (staysInPlay({ catalog, s }, id)) return true;
  return stage.upgrades.length === 0 && !stage.effects.some((e) => TURNS_ITSELF.test(e.text));
}
