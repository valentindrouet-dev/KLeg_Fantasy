import type { Category, ResourceId } from "../data/schema";
import { productionGroups } from "./production";
import { computeScore, kingdomCards } from "./score";
import { activeStage } from "./state";
import type { Catalog, GameState } from "./types";

// Statistiques du royaume (fenêtre « Stats ») : cartes par zone, production, gloire, mots-clés, catégories.

export type KingdomStats = {
  cards: { total: number; deck: number; play: number; discard: number; permanent: number };
  production: Record<ResourceId, number>; // icônes de production fixes (sans « / »)
  flexible: number; // productions au choix (« / »)
  fame: number;
  keywords: [string, number][]; // du plus fréquent au moins fréquent
  categories: [Category, number][];
  discovered: number;
  destroyed: number;
  inBox: number;
};

function counted<K extends string>(items: K[]): [K, number][] {
  const m = new Map<K, number>();
  for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function kingdomStats(catalog: Catalog, s: GameState): KingdomStats {
  const kingdom = kingdomCards(s);
  const production: Record<ResourceId, number> = Object.fromEntries(catalog.resources.map((r) => [r, 0]));
  let flexible = 0;
  const keywords: string[] = [];
  const categories: Category[] = [];
  for (const id of kingdom) {
    for (const g of productionGroups(catalog, s, id)) {
      if (g.options.length === 1) for (const r of g.options[0] ?? []) production[r] = (production[r] ?? 0) + 1;
      else flexible += 1;
    }
    const stage = activeStage(catalog, s, id);
    if (!stage) continue;
    keywords.push(...stage.keywords);
    categories.push(stage.category);
  }
  return {
    cards: {
      total: kingdom.length,
      deck: s.zones.deck.length,
      play: s.zones.play.length,
      discard: s.zones.discard.length,
      permanent: s.zones.permanent.length,
    },
    production,
    flexible,
    fame: computeScore(catalog, s).total,
    keywords: counted(keywords),
    categories: counted(categories),
    discovered: s.discoveries.length,
    destroyed: s.zones.destroyed.length,
    inBox: s.zones.box.length,
  };
}
