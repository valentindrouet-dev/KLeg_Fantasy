import type { ResourceId, Stage, StageId } from "../data/schema";
import { productionGroups } from "./production";
import { activeStage, cardName, hasKeyword, instance, template } from "./state";
import type { Catalog, GameState, InstanceId } from "./types";

// Score (spec 4.4) : gloire des stages actifs de tout le royaume + gloire purgée cumulée.
// Gloire variable (« * ») : pistes cochées, objectifs, murs, cases de gloire écrites.

export type ScoreLine = { card: InstanceId; name: string; fame: number; variable: boolean };
export type ScoreReport = {
  total: number;
  purgedFame: number;
  lines: ScoreLine[];
  /** Cartes dont la gloire est calculée (pistes, objectifs…). */
  variable: InstanceId[];
};

/** Le royaume : deck, jeu, défausse et permanentes (jamais la boîte, les détruites ni les bloquées). */
export function kingdomCards(s: GameState): InstanceId[] {
  return [...s.zones.deck, ...s.zones.play, ...s.zones.discard, ...s.zones.permanent];
}

const checkKey = (stage: StageId, box: string): string => `${stage}/${box}`;

function boxes(catalog: Catalog, s: GameState, id: InstanceId, stage: StageId) {
  const c = instance(s, id);
  const list = template(catalog, c.templateId).stages[String(stage) as "1"]?.checkboxes ?? [];
  return list.map((b) => ({ ...b, marked: c.checkedBoxes.includes(checkKey(stage, b.id)), written: c.written?.[checkKey(stage, b.id)] }));
}

/** Production d'une ressource dans le royaume : par groupe, le plus grand nombre de cette icône parmi les options. */
function kingdomProduction(catalog: Catalog, s: GameState, r: ResourceId): number {
  return kingdomCards(s).reduce(
    (sum, id) => sum + productionGroups(catalog, s, id).reduce((n, g) => n + Math.max(...g.options.map((o) => o.filter((x) => x === r).length)), 0),
    0,
  );
}

const nonPermanent = (s: GameState): InstanceId[] => kingdomCards(s).filter((id) => !s.zones.permanent.includes(id));

/** Gloire calculée d'un stage à « * », ou null si la règle n'est pas reconnue. */
function variableFame(catalog: Catalog, s: GameState, id: InstanceId, stage: Stage): number | null {
  const text = stage.text;
  const t = template(catalog, instance(s, id).templateId);
  const own = boxes(catalog, s, id, stage.id);
  const marks = own.filter((b) => b.marked).length;
  // Vassal States : tous les stages valent la somme des « 20 » écrits sur le dernier.
  if (Object.values(t.stages).some((st) => st?.text.includes("All stages of this card are worth the same as the last stage."))) {
    return boxes(catalog, s, id, 4).reduce((sum, b) => sum + (b.written ?? 0), 0);
  }
  if (text.includes("worth the highest marked {fame}")) return stage.fame + Math.max(0, ...own.filter((b) => b.marked).map((b) => b.fame ?? 0));
  if (text.includes("Worth 5{fame} for each {mark} on the other side.")) return 5 * boxes(catalog, s, id, 1).filter((b) => b.marked).length;
  const perMark = /Worth \+?(-?\d+)\{fame\} (?:per|for every) \{mark\}/.exec(text);
  if (perMark) return stage.fame + Number(perMark[1]) * marks;
  if (text.includes("Worth -5{fame} for each unmarked box.")) return -5 * (own.length - marks);
  if (text.includes("Worth 2{fame} per person.")) return 2 * kingdomCards(s).filter((x) => hasKeyword(catalog, s, x, "Person")).length;
  if (text.includes("Worth 2{fame} per production of {sword}.")) return 2 * kingdomProduction(catalog, s, "sword");
  if (text.includes("You want 75 or more cards in your kingdom")) return -2 * Math.max(0, 75 - nonPermanent(s).length);
  if (text.includes("per card with exactly 0{fame}")) return -nonPermanent(s).filter((x) => x !== id && cardFame(catalog, s, x) === 0).length;
  if (text.includes("Worth 25{fame} if there is no enemy in your kingdom.")) return kingdomCards(s).some((x) => hasKeyword(catalog, s, x, "Enemy")) ? 0 : 25;
  if (text.includes("Worth 25{fame} if your production of {tradeGood} is 10 or more.")) return kingdomProduction(catalog, s, "tradeGood") >= 10 ? 25 : 0;
  if (text.includes("Worth 4{fame} for each wall, including this.")) {
    return 4 * kingdomCards(s).filter((x) => /\bWall\b/.test(activeStage(catalog, s, x)?.name ?? "")).length;
  }
  if (own.some((b) => b.text?.startsWith("Write the number"))) return own.reduce((sum, b) => sum + (b.written ?? 0), 0);
  return null;
}

export function cardFame(catalog: Catalog, s: GameState, id: InstanceId): number {
  const stage = activeStage(catalog, s, id);
  const c = s.cards[id];
  const stickerFame = c?.stickers.reduce((sum, st) => sum + (stage && st.stage === stage.id ? (st.fame ?? 0) : 0), 0) ?? 0;
  if (!stage) return stickerFame;
  const computed = stage.fameVariable ? variableFame(catalog, s, id, stage) : null;
  return (computed ?? stage.fame) + stickerFame;
}

export function computeScore(catalog: Catalog, s: GameState): ScoreReport {
  const lines = kingdomCards(s).map((id): ScoreLine => {
    const stage = activeStage(catalog, s, id);
    return { card: id, name: cardName(catalog, s, id), fame: cardFame(catalog, s, id), variable: stage?.fameVariable ?? false };
  });
  const total = lines.reduce((sum, l) => sum + l.fame, 0) + s.purgedFame;
  return { total, purgedFame: s.purgedFame, lines, variable: lines.filter((l) => l.variable).map((l) => l.card) };
}
