import { cardId } from "../../src/data/schema";
import {
  applyAction,
  createGame,
  getLegalActions,
  type Action,
  type Catalog,
  type GameState,
  type InstanceId,
  type ResourceCounts,
  type Zone,
} from "../../src/engine";

// Outils de test : partie de Feudal Kingdom et mise en situation directe (contourne les règles exprès).

export const fk = (serial: number): InstanceId => cardId("FeudalKingdom", serial);

export function newGame(catalog: Catalog, seed = 1, undoMode: "strict" | "free" = "free"): GameState {
  return createGame(catalog, { expansion: "FeudalKingdom", seed, undoMode });
}

export type Arrangement = {
  play?: number[];
  deck?: number[]; // dans l'ordre, dessus en premier
  discard?: number[];
  permanent?: number[];
  resources?: ResourceCounts;
  orientation?: Record<number, { side: "front" | "back"; rotation: 0 | 180 }>;
};

/**
 * Remet les cartes 1 à 10 dans la boîte puis place les cartes demandées.
 * Les cartes non citées restent dans la boîte.
 */
export function arrange(catalog: Catalog, a: Arrangement, seed = 1): GameState {
  const s = structuredClone(newGame(catalog, seed));
  const all = Object.keys(s.cards);
  const zones: Record<Zone, InstanceId[]> = { box: [], deck: [], play: [], discard: [], permanent: [], destroyed: [], blocked: [] };
  const placed = new Set<number>();
  for (const [zone, serials] of [
    ["play", a.play],
    ["deck", a.deck],
    ["discard", a.discard],
    ["permanent", a.permanent],
  ] as const) {
    for (const n of serials ?? []) {
      zones[zone].push(fk(n));
      placed.add(n);
    }
  }
  zones.box = all.filter((id) => !placed.has(s.cards[id]?.serial ?? -1));
  s.zones = zones;
  s.pending = null;
  s.queue = [];
  for (const k of Object.keys(s.resources)) s.resources[k] = a.resources?.[k] ?? 0;
  for (const [n, o] of Object.entries(a.orientation ?? {})) {
    const c = s.cards[fk(Number(n))];
    if (c) c.orientation = o;
  }
  return s;
}

/** Applique une suite d'actions. */
export function run(catalog: Catalog, s: GameState, ...actions: Action[]): GameState {
  return actions.reduce((st, a) => applyAction(catalog, st, a), s);
}

export function legal(catalog: Catalog, s: GameState): Action[] {
  return getLegalActions(catalog, s);
}

/** Joue « Passer » jusqu'à ce que la condition soit vraie (ou que la partie se termine). */
export function passUntil(catalog: Catalog, s: GameState, done: (s: GameState) => boolean, max = 500): GameState {
  let st = s;
  for (let i = 0; i < max && !done(st) && st.phase === "playing"; i++) {
    const actions = getLegalActions(catalog, st);
    const next = actions.find((x) => x.type === "pass") ?? actions[0];
    if (!next) break;
    st = applyAction(catalog, st, next);
  }
  return st;
}
