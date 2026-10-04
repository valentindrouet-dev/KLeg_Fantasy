import type { CardTemplate, Orientation, StageId } from "../../data/schema";
import { activeStage, instance, isFullImageFace, stageIdAt, template, zoneOf, type Catalog, type GameState, type InstanceId } from "../../engine";
import type { Goal } from "../../persistence/kingdoms";

// Objectifs du joueur (demande du 2026-10-04) : une moitié de carte marquée par un appui long est entourée en doré
// jusqu'à ce que la carte atteigne cette étape ; la boîte d'amélioration qui y mène est dorée aussi.

export type GoalView = { stages: StageId[]; arrows: ("flip" | "rotate")[] };

/** Un objectif est atteint quand la carte est à cette étape ; il tombe aussi si la carte quitte le royaume. */
export function goalOpen(catalog: Catalog, s: GameState, g: Goal): boolean {
  if (!s.cards[g.card]) return false;
  const zone = zoneOf(s, g.card);
  if (zone === "destroyed" || zone === "purged") return false;
  return activeStage(catalog, s, g.card)?.id !== g.stage;
}

/** Première amélioration du plus court chemin d'améliorations de l'étape actuelle vers `to`, ou null. */
function firstStep(catalog: Catalog, s: GameState, id: InstanceId, to: StageId): "flip" | "rotate" | null {
  const t = template(catalog, instance(s, id).templateId);
  const from = activeStage(catalog, s, id)?.id;
  if (from === undefined) return null;
  const seen = new Set<StageId>([from]);
  let frontier: { stage: StageId; first: "flip" | "rotate" | null }[] = [{ stage: from, first: null }];
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const { stage, first } of frontier) {
      for (const u of t.stages[String(stage) as "1"]?.upgrades ?? []) {
        if (seen.has(u.toStage)) continue;
        const step = first ?? u.arrow;
        if (u.toStage === to) return step;
        seen.add(u.toStage);
        next.push({ stage: u.toStage, first: step });
      }
    }
    frontier = next;
  }
  return null;
}

/** Ce qu'il faut dorer sur une carte : les étapes visées encore à atteindre, et les améliorations qui y mènent. */
export function goalView(catalog: Catalog, s: GameState, goals: readonly Goal[], id: InstanceId): GoalView | undefined {
  const open = goals.filter((g) => g.card === id && goalOpen(catalog, s, g));
  if (open.length === 0) return undefined;
  const arrows = open.flatMap((g) => {
    const a = firstStep(catalog, s, id, g.stage);
    return a ? [a] : [];
  });
  return { stages: open.map((g) => g.stage), arrows: [...new Set(arrows)] };
}

/** Étape de la moitié touchée d'une face (face à image pleine : son unique étape). */
export function stageAtPoint(t: CardTemplate, o: Orientation, y: number): StageId | null {
  if (isFullImageFace(t, o.side) || y < 0.5) return stageIdAt(t, o) ?? stageIdAt(t, { side: o.side, rotation: o.rotation === 0 ? 180 : 0 });
  return stageIdAt(t, { side: o.side, rotation: o.rotation === 0 ? 180 : 0 });
}
