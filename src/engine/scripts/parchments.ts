import { cardId } from "../../data/schema";
import { boxCardsBySerial, discoverNormally, offerDiscovery } from "../flow";
import type { ParchmentImpl } from "../types";

// Instructions des parchemins de Feudal Kingdom qui ne font que régler la découverte de la manche.
// Les parchemins 23 (choix de recommencer) et 24 (stickers) arrivent en P3.

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Voir les cartes `from`..`to`, en découvrir `pick`, détruire les autres (parchemins 30 et 47). */
const lookAndChoose =
  (from: number, to: number, pick: number): ParchmentImpl =>
  (d) =>
    offerDiscovery(d, boxCardsBySerial(d, range(from, to)), pick, "destroy", null);

export const feudalKingdomParchments: ReadonlyMap<string, ParchmentImpl> = new Map([
  // « Instead of discovering the next 2 cards, look at the 4 next cards (31-34). Choose 2 to discover and destroy the other 2. »
  [cardId("FeudalKingdom", 30), lookAndChoose(31, 34, 2)],
  // « Discover 5 cards this round, instead of 2 (cards 38-42). » Le choix de face vient de chooseSideOnDiscover.
  [cardId("FeudalKingdom", 37), (d) => discoverNormally(d, 5)],
  // « Look at the next 4 cards (48-51). Discover 2 of them and destroy the other 2. »
  [cardId("FeudalKingdom", 47), lookAndChoose(48, 51, 2)],
  // « Discover 2 cards as normal (cards 69-70). This is your last round. » La dernière manche est marquée à la découverte.
  [cardId("FeudalKingdom", 68), (d) => discoverNormally(d, 2)],
]);
