import { describe, expect, it } from "vitest";
import { effectKey } from "../../src/engine/effects/registry";
import { loadCatalog } from "../helpers/catalog";

// Tous les effets des cartes de Feudal Kingdom (1 à 135) et des mini-extensions (136 à 138) sont automatisés :
// action (catalog.effects), déclencheur (catalog.triggers), parchemin (catalog.parchments) ou règle passive.
const RULES_ELSEWHERE = new Set([
  // passives.ts
  "This card has +{coin} production for each person in play.",
  "All persons, including Scientist, have +1{coin} production.",
  "Your lands have +{coin}{coin} production.",
  "You may not advance.",
  "You may not advance, upgrade, or use {time} effects.",
  "Buildings have +1{coin} production.",
  "All cards have 1 less {coin} production, and effects give 1 less {coin}.",
  "Each seafaring card has +{coin} production.",
  "{tradeGood} and {wood} may be used interchangeably.",
  "When you advance, play 2 additional cards.",
  // ops.ts : canBeDestroyed, discardablePersons
  "Cannot be destroyed unless Lord Nimrod has been destroyed.",
  "When discarding a person, you may reset this instead.",
  // Interface : la 2e carte de la pioche est montrée tant que Watchtower est en jeu.
  "You may look at the top 2 cards of your deck.",
  // Mini-extensions : passives.ts (Prosperity, Surplus), flow.ts (Border Dispute), campaign.ts (fins d'étape).
  "Play 1 round where all friendly cards have +{coin} production. Then {rotate}.",
  "Play 1 round where lands that produce {coin} may produce {tradeGood} instead. Then {rotate}.",
  "Play 1 round where all lands stay in play. Then {rotate}.",
  "Play 1 round. Then, for each {mark} on Uprising, you must cross out 1 production on 1 card. Then destroy this.",
  "Play 1 round. Then destroy this and 1 card with {coin} production.",
  // Merchants : passives.ts (Brigands, Brigand Boss) ; interface (les cartes proposées s'inspectent depuis la carte).
  "You cannot play cards, upgrade, or use other {time} effects.",
  "You cannot play cards, upgrade, or use {time} effects.",
  "You may look at the cards offered.",
]);
// Purge (campaign.ts) : Aethan Estate.
const PURGE = /^When you purge this card/;

// Extensions dont les effets sont automatisés ; les autres s'y ajoutent une fois faites.
const INTEGRATED = ["FeudalKingdom", "Merchants"];

describe("couverture des effets", async () => {
  const catalog = await loadCatalog();
  it("chaque effet des cartes 1 à 138 est automatisé", () => {
    const missing: string[] = [];
    for (const t of catalog.templates.values()) {
      if (!INTEGRATED.includes(t.expansion) || t.serial < 1 || t.serial > 138 || t.isParchment) continue;
      for (const [k, stage] of Object.entries(t.stages)) {
        for (const e of stage?.effects ?? []) {
          const key = effectKey(t.id, Number(k) as 1, e.id);
          if (catalog.effects.has(key) || catalog.triggers.has(key) || RULES_ELSEWHERE.has(e.text) || PURGE.test(e.text)) continue;
          missing.push(`#${t.serial} s${k} ${e.id} (${e.type}) ${e.text}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
