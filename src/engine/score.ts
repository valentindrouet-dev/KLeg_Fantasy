import { activeStage, cardName } from "./state";
import type { Catalog, GameState, InstanceId } from "./types";

// Score (spec 4.4) : gloire des stages actifs de tout le royaume + gloire purgée cumulée.

export type ScoreLine = { card: InstanceId; name: string; fame: number; variable: boolean };
export type ScoreReport = {
  total: number;
  purgedFame: number;
  lines: ScoreLine[];
  /** Cartes dont la gloire dépend d'un calcul pas encore automatisé (ruban « * », objectifs). */
  variable: InstanceId[];
};

/** Le royaume : deck, jeu, défausse et permanentes (jamais la boîte ni les cartes détruites). */
export function kingdomCards(s: GameState): InstanceId[] {
  return [...s.zones.deck, ...s.zones.play, ...s.zones.discard, ...s.zones.permanent];
}

export function cardFame(catalog: Catalog, s: GameState, id: InstanceId): number {
  const stage = activeStage(catalog, s, id);
  const c = s.cards[id];
  const stickerFame = c?.stickers.reduce((sum, st) => sum + (st.fame ?? 0), 0) ?? 0;
  return (stage?.fame ?? 0) + stickerFame;
}

export function computeScore(catalog: Catalog, s: GameState): ScoreReport {
  const lines = kingdomCards(s).map((id): ScoreLine => {
    const stage = activeStage(catalog, s, id);
    return { card: id, name: cardName(catalog, s, id), fame: cardFame(catalog, s, id), variable: stage?.fameVariable ?? false };
  });
  const total = lines.reduce((sum, l) => sum + l.fame, 0) + s.purgedFame;
  return { total, purgedFame: s.purgedFame, lines, variable: lines.filter((l) => l.variable).map((l) => l.card) };
}
