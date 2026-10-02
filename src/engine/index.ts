// Moteur de règles pur (spec section 4) : aucune dépendance à l'interface, au navigateur ou à Node.

export * from "./types";
export { getLegalActions, applyAction, isLegal, actionKey, usableEffects } from "./actions";
export { createCatalog, createGame, canRestartKingdom, DEFAULT_EXPANSION, STARTING_KINGDOM } from "./setup";
export { newSession, resumeSession, current, act, canUndo, undo, replay, UNDO_WINDOW, type GameRecord, type Session } from "./session";
export { computeScore, kingdomCards, cardFame, type ScoreReport, type ScoreLine } from "./score";
export { upgradeOptions, type UpgradeOption } from "./upgrade";
export { productionGroups, productionCount, canAddResourceSticker, addResourceSticker } from "./production";
export { describeAction } from "./describe";
export { activeStage, cardName, zoneOf, formatCounts, totalResources, instance, template, stageIdAt } from "./state";
export { randomSeed } from "./rng";
