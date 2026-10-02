import type { CardTemplate, Orientation, ResourceId, Side, StageId } from "../data/schema";

// Types du moteur (spec section 4). Tout l'état d'une partie est sérialisable en JSON :
// une partie = configuration + liste d'actions (event sourcing, voir session.ts).

export type InstanceId = string;

// Zones gérées en P1. Blocage, équipement et purge arrivent en P3/P4.
export type Zone = "box" | "deck" | "play" | "discard" | "permanent" | "destroyed";
export const ZONES: readonly Zone[] = ["box", "deck", "play", "discard", "permanent", "destroyed"];

export type StickerPlacement = { sticker: string; stage: StageId; resource?: ResourceId; fame?: number };

export type CardInstance = {
  instanceId: InstanceId;
  templateId: string;
  serial: number;
  orientation: Orientation;
  stickers: StickerPlacement[];
  checkedBoxes: string[];
  crossedOutEffects: string[];
  crossedOutProduction: string[];
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
  | { kind: "parchment"; card: InstanceId };

/** Étapes de déroulement en attente : elles reprennent dès qu'aucune décision n'est en cours. */
export type FlowStep =
  | { kind: "roundDiscovery" }
  | { kind: "discover"; card: InstanceId }
  | { kind: "shuffle" }
  | { kind: "startTurn" };

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
};

export type Action =
  | { type: "produce"; card: InstanceId; choices: number[] } // un indice d'option par groupe de production
  | { type: "upgrade"; card: InstanceId; upgrade: string; discard: InstanceId[] }
  | { type: "useEffect"; card: InstanceId; effect: string; targets: InstanceId[]; option: number | null }
  | { type: "advance" }
  | { type: "pass" }
  | { type: "chooseDiscovery"; card: InstanceId }
  | { type: "chooseSide"; side: Side }
  | { type: "acknowledgeParchment" };

export type EffectParams = { targets: InstanceId[]; option: number | null };

/** Contexte de travail : le catalogue (statique) et un brouillon d'état qu'on peut muter. */
export type Draft = { catalog: Catalog; s: GameState };

export type EffectImpl = {
  /** Jeux de paramètres légaux ; tableau vide = effet inutilisable maintenant. */
  params: (d: Draft, card: InstanceId) => EffectParams[];
  /** Applique le corps de l'effet. Le coût lié au type (défausser, détruire) est déjà payé. */
  apply: (d: Draft, card: InstanceId, p: EffectParams) => void;
};

/** Instructions d'un parchemin, appliquées après lecture, avant sa destruction. */
export type ParchmentImpl = (d: Draft, card: InstanceId) => void;

export type Catalog = {
  templates: ReadonlyMap<string, CardTemplate>;
  resources: readonly ResourceId[];
  effects: ReadonlyMap<string, EffectImpl>; // clé : effectKey(templateId, stage, effectId)
  parchments: ReadonlyMap<string, ParchmentImpl>; // clé : templateId
};

export class IllegalActionError extends Error {
  override name = "IllegalActionError";
}
