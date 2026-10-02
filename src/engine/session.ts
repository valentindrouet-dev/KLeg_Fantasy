import { applyAction } from "./actions";
import { createGame } from "./setup";
import type { Action, Catalog, GameConfig, GameState } from "./types";

// Event sourcing (spec 4.1 et 6.2) : une partie = configuration + liste d'actions.
// La session garde l'état après chaque action pour annuler sans rejouer.

export type GameRecord = { config: GameConfig; actions: Action[] };

export type Session = {
  catalog: Catalog;
  record: GameRecord;
  states: GameState[]; // states[0] : mise en place ; states[i] : après l'action i
};

export function newSession(catalog: Catalog, config: GameConfig): Session {
  return { catalog, record: { config, actions: [] }, states: [createGame(catalog, config)] };
}

export function current(session: Session): GameState {
  const s = session.states.at(-1);
  if (!s) throw new Error("Session sans état");
  return s;
}

export function act(session: Session, action: Action): Session {
  const next = applyAction(session.catalog, current(session), action);
  return {
    ...session,
    record: { ...session.record, actions: [...session.record.actions, action] },
    states: [...session.states, next],
  };
}

/**
 * Mode Libre : on peut toujours annuler. Mode Strict : seulement une action du tour en cours
 * qui n'a révélé aucune information (carte du deck, découverte, mélange).
 */
export function canUndo(session: Session): boolean {
  const n = session.states.length;
  if (n < 2) return false;
  if (session.record.config.undoMode === "free") return true;
  const before = session.states[n - 2] as GameState;
  const after = session.states[n - 1] as GameState;
  return before.revealCount === after.revealCount && before.round === after.round && before.turn === after.turn;
}

export function undo(session: Session): Session {
  if (!canUndo(session)) throw new Error("Annulation impossible");
  return {
    ...session,
    record: { ...session.record, actions: session.record.actions.slice(0, -1) },
    states: session.states.slice(0, -1),
  };
}

/** Rejoue une partie enregistrée (import, reprise après rechargement). */
export function replay(catalog: Catalog, record: GameRecord): Session {
  return record.actions.reduce((s, a) => act(s, a), newSession(catalog, record.config));
}
