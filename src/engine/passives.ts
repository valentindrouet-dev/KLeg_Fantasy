import type { ResourceId } from "../data/schema";
import { activeStage, countPersons, hasKeyword, instance, isFriendly, type Pool } from "./state";
import type { Catalog, GameState, InstanceId } from "./types";

// Effets passifs qui modifient les règles tant que leur carte est en jeu (ou permanente) : bonus de production,
// interdictions, ressources interchangeables. Reconnus à leur texte imprimé exact, donc valables pour toutes
// les copies d'une carte.

const T = {
  cathedral: "This card has +{coin} production for each person in play.",
  scientist: "All persons, including Scientist, have +1{coin} production.",
  rainLands: "Your lands have +{coin}{coin} production.",
  rainNoAdvance: "You may not advance.",
  darkRestriction: "You may not advance, upgrade, or use {time} effects.",
  townWell: "Buildings have +1{coin} production.",
  pirate: "All cards have 1 less {coin} production, and effects give 1 less {coin}.",
  fishingExcellence: "Each seafaring card has +{coin} production.",
  woodShipment: "{tradeGood} and {wood} may be used interchangeably.",
  bloodCurse: "When you advance, play 2 additional cards.",
  prosperity: "Play 1 round where all friendly cards have +{coin} production. Then {rotate}.",
  surplus: "Play 1 round where lands that produce {coin} may produce {tradeGood} instead. Then {rotate}.",
  borderDispute: "Play 1 round where all lands stay in play. Then {rotate}.",
  // Merchants 19 : Brigands (leur propre effet {time}, les vaincre, reste permis), puis Brigand Boss.
  brigands: "You cannot play cards, upgrade, or use other {time} effects.",
  brigandBoss: "You cannot play cards, upgrade, or use {time} effects.",
} as const;

/** Effets actifs (non rayés) du stage visible d'une carte. */
function activeTexts(catalog: Catalog, s: GameState, id: InstanceId): string[] {
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  const crossed = instance(s, id).crossedOutEffects;
  return stage.effects.filter((e) => !crossed.includes(`${stage.id}/${e.id}`)).map((e) => e.text);
}

/** Nombre de cartes en jeu (et permanentes) dont un effet porte ce texte. */
export function countSources(catalog: Catalog, s: GameState, text: string, zones: readonly ("play" | "permanent")[] = ["play", "permanent"]): number {
  return zones.flatMap((z) => s.zones[z]).filter((id) => activeTexts(catalog, s, id).includes(text)).length;
}

export const personsInPlay = (catalog: Catalog, s: GameState): InstanceId[] =>
  s.zones.play.filter((id) => hasKeyword(catalog, s, id, "Person"));

/** Groupes de production ajoutés par les passifs, une icône par groupe. */
export function productionBonus(catalog: Catalog, s: GameState, id: InstanceId): ResourceId[][] {
  const coins: number[] = [];
  if (activeTexts(catalog, s, id).includes(T.cathedral)) coins.push(countPersons(catalog, s, personsInPlay(catalog, s)));
  if (hasKeyword(catalog, s, id, "Person")) coins.push(countSources(catalog, s, T.scientist, ["play"]));
  if (hasKeyword(catalog, s, id, "Land")) coins.push(2 * countSources(catalog, s, T.rainLands, ["play"]));
  if (hasKeyword(catalog, s, id, "Building")) coins.push(countSources(catalog, s, T.townWell, ["play"]));
  if (hasKeyword(catalog, s, id, "Seafaring")) coins.push(countSources(catalog, s, T.fishingExcellence));
  if (isFriendly(catalog, s, id)) coins.push(countSources(catalog, s, T.prosperity, ["permanent"]));
  const n = coins.reduce((a, b) => a + b, 0);
  return Array.from({ length: n }, () => ["coin"]);
}

/** Pirates en jeu : chacun retire 1 {coin} de chaque production et de chaque gain par effet. */
export const coinMalus = (catalog: Catalog, s: GameState): number => countSources(catalog, s, T.pirate, ["play"]);

/** Ressources interchangeables pour payer (Wood Shipment en jeu). */
export function payPool(catalog: Catalog, s: GameState): Pool {
  return countSources(catalog, s, T.woodShipment, ["play"]) > 0 ? ["wood", "tradeGood"] : null;
}

// noPlay : « You cannot play cards » (Brigands) : ni avancer, ni jouer une carte de la défausse par un effet.
export type Restrictions = { noAdvance: boolean; noUpgrade: boolean; noTime: boolean; noPlay: boolean };

export function restrictions(catalog: Catalog, s: GameState): Restrictions {
  const src = restrictionSources(catalog, s);
  return { noAdvance: src.advance.length > 0, noUpgrade: src.upgrade.length > 0, noTime: src.time.length > 0, noPlay: src.play.length > 0 };
}

/** Cartes en jeu responsables de chaque interdiction (Dark Prince, Rain, Brigands) : l'interface les fait trembler. */
export function restrictionSources(catalog: Catalog, s: GameState): { advance: InstanceId[]; upgrade: InstanceId[]; time: InstanceId[]; play: InstanceId[] } {
  const withText = (text: string) => s.zones.play.filter((id) => activeTexts(catalog, s, id).includes(text));
  const dark = withText(T.darkRestriction);
  const rain = withText(T.rainNoAdvance);
  const brigands = [...withText(T.brigands), ...withText(T.brigandBoss)];
  return { advance: [...dark, ...rain, ...brigands], upgrade: [...dark, ...brigands], time: [...dark, ...brigands], play: brigands };
}

/** Les effets {time} de cette carte sont-ils interdits ? Brigands interdit les « other {time} effects », pas le sien. */
export function timeBlockedFor(catalog: Catalog, s: GameState, card: InstanceId): boolean {
  return restrictionSources(catalog, s).time.some((src) => src !== card || !activeTexts(catalog, s, src).includes(T.brigands));
}

/** Effet qui joue une carte de la défausse (« Play 1 land … from discard pile », Beer) : interdit par Brigands. */
export const playsFromDiscard = (text: string): boolean => /\bplay\b[^.]*from (?:the |your )?discard pile/i.test(text);

/** Watchtower en jeu : on peut voir la deuxième carte de la pioche. */
export const canPeekSecond = (catalog: Catalog, s: GameState): boolean => countSources(catalog, s, "You may look at the top 2 cards of your deck.", ["play"]) > 0;

/** Cartes jouées en plus quand on avance (Blood Curse). */
export const extraAdvance = (catalog: Catalog, s: GameState): number => 2 * countSources(catalog, s, T.bloodCurse, ["play"]);

/** Surplus (mini-extension 137) : les terres peuvent produire {tradeGood} à la place de {coin}. */
export const surplusActive = (catalog: Catalog, s: GameState): boolean => countSources(catalog, s, T.surplus, ["permanent"]) > 0;

/** Border Dispute (mini-extension 138) : toutes les terres restent en jeu. */
export const landsStayInPlay = (catalog: Catalog, s: GameState): boolean => countSources(catalog, s, T.borderDispute, ["permanent"]) > 0;
