import { activeStage, instance, template } from "./state";
import type { Catalog, GameState, InstanceId } from "./types";

// Ce qu'on ne voit pas sur l'image d'une carte : cases cochées, compteur, gloire écrite, stickers.

export function cardBadges(catalog: Catalog, s: GameState, id: InstanceId): string[] {
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  const c = instance(s, id);
  const out: string[] = [];
  const boxes = template(catalog, c.templateId).stages[String(stage.id) as "1"]?.checkboxes ?? [];
  if (boxes.length) out.push(`☑ ${boxes.filter((b) => c.checkedBoxes.includes(`${stage.id}/${b.id}`)).length}/${boxes.length}`);
  const tally = c.tallies?.[String(stage.id)] ?? 0;
  if (tally) out.push(`{tradeGood} ${tally}`);
  const written = Object.entries(c.written ?? {}).filter(([k]) => k.startsWith(`${stage.id}/`)).reduce((sum, [, n]) => sum + n, 0);
  if (written) out.push(`✎ {fame}${written}`);
  const stickers = c.stickers.filter((st) => st.stage === stage.id);
  if (stickers.length) {
    out.push(
      stickers
        .map((st) => (st.resource ? `+{${st.resource}}` : st.fame !== undefined ? `{fame}${st.fame}` : st.keyword ? st.keyword : st.staysInPlay ? "reste en jeu" : ""))
        .join(" "),
    );
  }
  return out;
}
