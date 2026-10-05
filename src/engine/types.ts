import type { CardTemplate, Orientation, ResourceId, Side, StageId } from "../data/schema";

// Types du moteur (spec section 4). Tout l'état d'une partie est sérialisable en JSON :
// une partie = configuration + liste d'actions (event sourcing, voir session.ts).

export type InstanceId = string;

// « blocked » : cartes bloquées, posées sous leur bloquante (GameState.blocks) ; elles n'existent plus pour le jeu.
// « purged » : cartes purgées (mini-extensions), leur gloire est passée dans GameState.purgedFame.
export type Zone = "box" | "deck" | "play" | "discard" | "permanent" | "destroyed" | "blocked" | "purged";
export const ZONES: readonly Zone[] = ["box", "deck", "play", "discard", "permanent", "destroyed", "blocked", "purged"];

/** Sticker posé : ressource (production), gloire, mot-clé (Knight) ou effet « Stays in play » (sticker 7). */
export type StickerPlacement = {
  sticker: string;
  stage: StageId;
  resource?: ResourceId;
  fame?: number;
  keyword?: string;
  staysInPlay?: boolean;
};

export type CardInstance = {
  instanceId: InstanceId;
  templateId: string;
  serial: number;
  orientation: Orientation;
  stickers: StickerPlacement[];
  checkedBoxes: string[];
  crossedOutEffects: string[];
  crossedOutProduction: string[]; // `${stage}/${groupe}/${indice d'icône}`
  crossedOutCosts?: string[]; // icônes rayées d'un coût d'amélioration : `${stage}/${amélioration}/${indice}`
  written?: Record<string, number>; // gloire écrite dans une case : clé checkKey(stage, case)
  plays?: number; // nombre de fois où la carte est entrée en jeu (Stranger : « 2nd play »)
  customName?: string; // nom donné par le joueur (Stranger, #92 : « 1st play: Give her a name! »)
  tallies?: Record<string, number>; // compteurs (Export : marchandises dépensées), par stage
};

export type ResourceCounts = Record<ResourceId, number>;

export type UndoMode = "strict" | "free";

export type GameConfig = {
  expansion: string;
  seed: number;
  undoMode: UndoMode;
};

/** Choix que le moteur attend du joueur avant de continuer (spec 4.1). */
export type PendingDecision =
  | {
      kind: "discoverChoice";
      source: InstanceId | null; // carte qui a lancé la découverte (null : parchemin déjà détruit)
      options: InstanceId[]; // cartes visibles parmi lesquelles choisir
      remaining: number; // nombre de cartes encore à choisir
      picked: InstanceId[];
      leftovers: "box" | "destroy"; // sort des cartes non choisies
    }
  | { kind: "chooseSide"; card: InstanceId }
  | { kind: "parchment"; card: InstanceId }
  | { kind: "newCards"; cards: InstanceId[] } // cartes découvertes en début de manche, à voir avant le mélange
  | {
      kind: "choice";
      source: InstanceId; // carte dont l'effet demande le choix
      script: string; // clé de l'effet (catalog.effects) ou du déclencheur (catalog.triggers)
      mode: "effect" | "trigger";
      effect: string; // id de l'effet sur le stage actif (mode effect)
      answers: Answer[]; // réponses déjà données
      request: ChoiceRequest;
      cancellable: boolean; // effet lancé par le joueur, rien n'est encore payé
      ctx: TriggerCtx;
    };

/** Question posée au joueur au cours d'un effet. */
export type ChoiceRequest =
  // none : la réponse vide est aussi permise (refuser l'effet), avec ce libellé de bouton.
  | { type: "cards"; prompt: string; options: InstanceId[]; min: number; max: number; none?: string }
  | { type: "resources"; prompt: string; options: ResourceId[]; count: number } // `count` ressources, répétitions permises
  // boxes : cases de la carte source qu'on peut toucher pour répondre (réponse { box }), en plus des options.
  // boxes : cases de la carte source qu'on peut toucher pour répondre (réponse { box }), en plus des options ;
  // card + spots « cost » : icônes de coût d'amélioration de cette carte (clés `${étape}/${amélioration}/${indice}`).
  | { type: "option"; prompt: string; labels: string[]; boxes?: string[]; card?: InstanceId; spots?: "checkbox" | "cost" };

export type Answer = { cards: InstanceId[] } | { resources: ResourceId[] } | { option: number } | { box: string };

/** Contexte d'un déclencheur : cartes jouées ensemble, cartes bloquées par la source… */
export type TriggerCtx = { cards?: InstanceId[] };

/** Étapes de déroulement en attente : elles reprennent dès qu'aucune décision n'est en cours. */
export type FlowStep =
  | { kind: "roundDiscovery" }
  // seen : déjà montrée au joueur (choix de découverte) ; chooseSide : le joueur choisit la face (parchemin 37 seulement).
  | { kind: "discover"; card: InstanceId; seen?: boolean; chooseSide?: boolean }
  | { kind: "shuffle" }
  | { kind: "startTurn" }
  | { kind: "trigger"; card: InstanceId; script: string; ctx: TriggerCtx }
  | { kind: "endTurn" } // effets « End of Turn », puis cleanupTurn
  | { kind: "cleanupTurn" }
  | { kind: "endRound" }
  | { kind: "nextRound" }
  | { kind: "reviewDiscoveries"; since: number } // montre les cartes découvertes depuis discoveries[since]
  | { kind: "expansionEnd" }; // fin de manche d'une mini-extension : la carte change d'étape (ou est détruite)

/**
 * Suivi du royaume après la partie de base (spec 4.7) : score de la partie de base, mini-extensions jouées et leur
 * score (chemin de score), mini-extension en cours.
 */
export type Campaign = {
  base: number | null;
  played: { serial: number; name: string; score: number }[];
  current: InstanceId | null;
  rounds: number; // manches jouées dans la mini-extension en cours
  stageAtRoundStart: number | null; // étape de la carte d'extension au début de la manche
};

export type LogEntry = { round: number; turn: number; text: string };

export type GameState = {
  config: GameConfig;
  rng: number; // état du générateur pseudo-aléatoire
  round: number;
  turn: number;
  phase: "playing" | "gameOver";
  finalRound: boolean;
  zones: Record<Zone, InstanceId[]>; // deck : index 0 = dessus ; discard : dernier = dessus
  cards: Record<InstanceId, CardInstance>;
  resources: ResourceCounts;
  pending: PendingDecision | null;
  queue: FlowStep[];
  purgedFame: number;
  discoveries: number[]; // numéros des cartes découvertes, dans l'ordre (parchemins compris)
  revealCount: number; // augmente à chaque information nouvelle (carte du deck, découverte, mélange)
  lostResources: ResourceCounts; // ressources perdues pendant la dernière action
  log: LogEntry[];
  blocks?: Record<InstanceId, InstanceId[]>; // bloquante → cartes bloquées
  keepInPlay?: InstanceId[]; // cartes qu'un effet « make … stay in play » garde jusqu'au prochain tour
  campaign?: Campaign;
};

export type Action =
  | { type: "produce"; card: InstanceId; choices: number[] } // un indice d'option par groupe de production
  | { type: "upgrade"; card: InstanceId; upgrade: string; discard: InstanceId[] }
  | { type: "useEffect"; card: InstanceId; effect: string; targets: InstanceId[]; option: number | null }
  | { type: "advance" }
  | { type: "pass" }
  | { type: "chooseDiscovery"; card: InstanceId }
  | { type: "chooseSide"; side: Side }
  | { type: "acknowledgeParchment" }
  // sides : face choisie des cartes à flèches rouges présentées (absente = recto).
  | { type: "acknowledgeDiscoveries"; sides?: Record<InstanceId, Side> }
  | { type: "startExpansion"; card: InstanceId } // partie terminée : jouer une mini-extension (136, 137, 138)
  | { type: "manual"; op: ManualOp }
  | { type: "choose"; answer: Answer }
  | { type: "cancelChoice" };

/** Résolution à la main (voir manual.ts) : opérations hors règles du mode développeur, rejouables comme les autres. */
export type ManualOp =
  | { kind: "resource"; resource: ResourceId; delta: number }
  | { kind: "move"; card: InstanceId; to: Zone; position: "top" | "bottom" }
  | { kind: "orient"; card: InstanceId; orientation: Orientation }
  | { kind: "discover"; card: InstanceId }
  | { kind: "check"; card: InstanceId; box: string } // coche ou décoche une case du stage actif
  | { kind: "sticker"; card: InstanceId; sticker: string; resource: ResourceId | null; fame: number | null }
  | { kind: "effect"; card: InstanceId; effect: string }
  // Mode développeur (demande du 2026-10-05) : passer une question bloquée, effacer les effets rayés du stage actif.
  | { kind: "skip" }
  // Stranger (#92) : le nom que le joueur lui donne (demande du 2026-10-05). Pas une question : un geste libre.
  | { kind: "name"; card: InstanceId; name: string }
  | { kind: "refresh"; card: InstanceId };

export type EffectParams = { targets: InstanceId[]; option: number | null; answers?: Answer[] };

/** Contexte de travail : le catalogue (statique) et un brouillon d'état qu'on peut muter. */
export type Draft = { catalog: Catalog; s: GameState };

export type EffectImpl = {
  /** Jeux de paramètres légaux ; tableau vide = effet inutilisable maintenant. */
  params: (d: Draft, card: InstanceId) => EffectParams[];
  /** Applique le corps de l'effet. Le coût lié au type (défausser, détruire) est déjà payé. */
  apply: (d: Draft, card: InstanceId, p: EffectParams) => void;
  /** Ressources que l'effet dépense (pour payer avec des cartes engagées). */
  cost?: readonly string[];
  /** Payer avec toutes les cartes engagées utiles, pas seulement le minimum (Export : tout dépenser). */
  useAllEngaged?: boolean;
  /** Coût qui dépend de l'état (piste : la case suivante). */
  costOf?: (d: Draft, card: InstanceId, p?: EffectParams) => readonly string[];
  /** Ancienne forme sans cible (réponses à des questions) acceptée pour rejouer les parties enregistrées. */
  legacyAsk?: boolean;
  /**
   * Effet qui ne fait que gagner une ressource au choix (Servant, « Gain any N resources »), sans coût : les gains
   * possibles, un par paramètre `option`. La carte s'engage alors comme une carte de production.
   */
  gains?: (d: Draft) => ResourceId[][];
  /** Questions au joueur, une à la fois, avant tout paiement ; null quand tout est choisi (réponses dans p.answers). */
  ask?: (d: Draft, card: InstanceId, answers: Answer[]) => ChoiceRequest | null;
};

export type TriggerTiming =
  | "played" // quand la carte entre en jeu (avec celles jouées en même temps)
  | "otherPlayed" // une autre carte entre en jeu alors que celle-ci y est déjà (ctx.cards)
  | "endTurn"
  | "endRound" // ctx.cards : cartes que la source bloquait
  | "upgraded" // la carte vient d'être améliorée
  | "produced" // la carte vient de produire
  | "betweenRounds" // cartes permanentes, avant la découverte de la manche
  | "manual"; // lancé explicitement par un autre effet (queueScript)

/** Effet déclenché (types triggeredForced / triggeredOptional). */
export type TriggerImpl = {
  timing: TriggerTiming | readonly TriggerTiming[];
  optional: boolean;
  /** Le déclencheur s'applique-t-il ? (sinon il est ignoré sans question) */
  when?: (d: Draft, card: InstanceId, ctx: TriggerCtx) => boolean;
  ask?: (d: Draft, card: InstanceId, answers: Answer[], ctx: TriggerCtx) => ChoiceRequest | null;
  run: (d: Draft, card: InstanceId, answers: Answer[], ctx: TriggerCtx) => void;
  /** Effet optionnel refusé (ex. Impregnable Fortress : elle est alors défaussée normalement). */
  decline?: (d: Draft, card: InstanceId, ctx: TriggerCtx) => void;
  /** Question posée pour un effet optionnel (sinon le texte imprimé de l'effet). */
  prompt?: string;
  /**
   * Effet optionnel sans question Oui/Non : sa première question (cartes, avec `none`) se pose tout de suite, et la
   * réponse vide refuse l'effet. Les parties enregistrées avant répondaient d'abord Oui/Non : toujours accepté.
   */
  direct?: boolean;
};

/** Instructions d'un parchemin, appliquées après lecture, avant sa destruction. */
export type ParchmentImpl = (d: Draft, card: InstanceId) => void;

export type Catalog = {
  templates: ReadonlyMap<string, CardTemplate>;
  resources: readonly ResourceId[];
  effects: ReadonlyMap<string, EffectImpl>; // clé : effectKey(templateId, stage, effectId)
  parchments: ReadonlyMap<string, ParchmentImpl>; // clé : templateId
  triggers: ReadonlyMap<string, TriggerImpl>; // clé : effectKey(templateId, stage, effectId) ou clé de script
};

export class IllegalActionError extends Error {
  override name = "IllegalActionError";
}
