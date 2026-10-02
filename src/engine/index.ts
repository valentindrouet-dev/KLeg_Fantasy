// Moteur de règles pur (spec section 4) : aucune dépendance à l'interface, au navigateur ou à Node.

export * from "./types";
export { getLegalActions, applyAction, isLegal, actionKey, usableEffects } from "./actions";
export { createCatalog, createGame, canRestartKingdom, DEFAULT_EXPANSION, STARTING_KINGDOM } from "./setup";
export { newSession, current, act, canUndo, undo, replay, type GameRecord, type Session } from "./session";
export { computeScore, kingdomCards, cardFame, type ScoreReport, type ScoreLine } from "./score";
export { upgradeOptions, type UpgradeOption } from "./upgrade";
export { productionGroups, productionCount, canAddResourceSticker, addResourceSticker } from "./production";
export { describeAction } from "./describe";
export { activeStage, cardName, zoneOf, formatCounts } from "./state";
export { randomSeed } from "./rng";
