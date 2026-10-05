// Moteur de règles pur (spec section 4) : aucune dépendance à l'interface, au navigateur ou à Node.

export * from "./types";
export { getLegalActions, applyAction, isLegal, actionKey, usableEffects } from "./actions";
export { createCatalog, createGame, canRestartKingdom, DEFAULT_EXPANSION, STARTING_KINGDOM } from "./setup";
export { newSession, resumeSession, current, act, canUndo, undo, replay, UNDO_WINDOW, type GameRecord, type Session } from "./session";
export { computeScore, kingdomCards, cardFame, type ScoreReport, type ScoreLine } from "./score";
export { upgradeOptions, type UpgradeOption } from "./upgrade";
export { productionGroups, productionCount, canAddResourceSticker, addResourceSticker } from "./production";
export { describeAction } from "./describe";
export { activeStage, cardName, zoneOf, formatCounts, totalResources, instance, template, stageIdAt, printedStage, isFullImage, isFullImageFace } from "./state";
export { randomSeed } from "./rng";
export { planWithEngaged, candidateActions, engagedPotential, actionCost, paymentCandidates, gainEffectOf, sourceGroups } from "./payment";
export { kingdomStats, type KingdomStats } from "./stats";
export { manualEffects, validOrientations, checkKey, isManualOpValid } from "./manual";
export { cardBadges, showsTopHalfOnly } from "./badges";
export { exhaustedEffects, isEffectExhausted, type ExhaustedEffect } from "./exhausted";
export { staysInPlay, isStayInPlayCard } from "./flow";
export { canPeekSecond, restrictions, restrictionSources } from "./passives";
export { availableExpansions, expansionName, EXPANSION_SERIALS, inExpansion } from "./campaign";
export { boxViews, isOrderedTrack, type BoxView } from "./boxes";
export { refreshPendingPrompt } from "./flow";
