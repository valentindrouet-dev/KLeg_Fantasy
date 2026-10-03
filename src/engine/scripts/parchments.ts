import { cardId } from "../../data/schema";
import { boxCardsBySerial, discoverNormally, nextInBox, offerDiscovery, pushFront } from "../flow";
import { effectKey } from "../effects/registry";
import type { FlowStep, ParchmentImpl } from "../types";

// Instructions des parchemins de Feudal Kingdom : découvertes de la manche, stickers du 24. Pour le 23, le choix « recommencer » est proposé par l'interface
// avant de confirmer la lecture (canRestartKingdom) ; continuer applique ce script.

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Voir les cartes `from`..`to`, en découvrir `pick`, détruire les autres (parchemins 30 et 47). */
const lookAndChoose =
  (from: number, to: number, pick: number): ParchmentImpl =>
  (d) =>
    offerDiscovery(d, boxCardsBySerial(d, range(from, to)), pick, "destroy", null);

/** Découvre ces cartes, dans l'ordre (parchemins compris). */
const discoverSerials =
  (...serials: number[]): ParchmentImpl =>
  (d) =>
    pushFront(d, ...boxCardsBySerial(d, serials).map((card): FlowStep => ({ kind: "discover", card })));

/** Parchemin 24 : « Fertile Soil » puis « Efficiency », deux stickers à poser (effects/cards.ts). */
const stickers24: ParchmentImpl = (d, card) =>
  pushFront(
    d,
    ...["e1", "e2"].map((e): FlowStep => ({ kind: "trigger", card, script: effectKey(cardId("FeudalKingdom", 24), 1, e), ctx: {} })),
  );

export const feudalKingdomParchments: ReadonlyMap<string, ParchmentImpl> = new Map([
  [cardId("FeudalKingdom", 24), stickers24],
  // « If you continue, you will discover 4 cards, cards 24-27. »
  [cardId("FeudalKingdom", 23), discoverSerials(24, 25, 26, 27)],
  // « Instead of discovering the next 2 cards, look at the 4 next cards (31-34). Choose 2 to discover and destroy the other 2. »
  [cardId("FeudalKingdom", 30), lookAndChoose(31, 34, 2)],
  // « Discover 5 cards this round, instead of 2 (cards 38-42). […] For each card, you need to choose one of its sides
  // now » : seul cas où l'on choisit la face d'une carte découverte.
  [cardId("FeudalKingdom", 37), (d) => pushFront(d, ...nextInBox(d, 5).map((card): FlowStep => ({ kind: "discover", card, chooseSide: true })))],
  // « Look at the next 4 cards (48-51). Discover 2 of them and destroy the other 2. »
  [cardId("FeudalKingdom", 47), lookAndChoose(48, 51, 2)],
  // « Discover 2 cards as normal (cards 69-70). This is your last round. » La dernière manche est marquée à la découverte.
  [cardId("FeudalKingdom", 68), (d) => discoverNormally(d, 2)],
]);
