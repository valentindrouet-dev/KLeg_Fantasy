import { applyAction } from "./actions";
import { createGame } from "./setup";
import type { Action, Catalog, GameConfig, GameState } from "./types";

// Event sourcing (spec 4.1 et 6.2) : une partie = configuration + liste d'actions.
// La session garde les états des dernières actions pour annuler sans rejouer ;
// au-delà, l'annulation (mode Libre) rejoue l'enregistrement.

export type GameRecord = { config: GameConfig; actions: Action[] };

/** Nombre d'états gardés en mémoire (un état complet par action, journal compris). */
export const UNDO_WINDOW = 40;

export type Session = {
  catalog: Catalog;
  record: GameRecord;
  states: GameState[]; // états des dernières actions ; le dernier est l'état courant
};

export function newSession(catalog: Catalog, config: GameConfig): Session {
  return { catalog, record: { config, actions: [] }, states: [createGame(catalog, config)] };
}

/** Reprend une partie sauvegardée sans la rejouer. */
export function resumeSession(catalog: Catalog, record: GameRecord, state: GameState): Session {
  return { catalog, record, states: [state] };
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
    states: [...session.states, next].slice(-(UNDO_WINDOW + 1)),
  };
}

/**
 * Mode Libre : on peut toujours annuler. Mode Strict : seulement une action du tour en cours
 * qui n'a révélé aucune information (carte du deck, découverte, mélange).
 */
export function canUndo(session: Session): boolean {
  if (session.record.actions.length === 0) return false;
  if (session.record.config.undoMode === "free") return true;
  const before = session.states.at(-2);
  const after = session.states.at(-1);
  if (!before || !after) return false;
  return before.revealCount === after.revealCount && before.round === after.round && before.turn === after.turn;
}

export function undo(session: Session): Session {
  if (!canUndo(session)) throw new Error("Annulation impossible");
  const actions = session.record.actions.slice(0, -1);
  if (session.states.length >= 2) {
    return { ...session, record: { ...session.record, actions }, states: session.states.slice(0, -1) };
  }
  return replay(session.catalog, { ...session.record, actions });
}

/** Rejoue une partie enregistrée (import, annulation au-delà de la fenêtre). */
export function replay(catalog: Catalog, record: GameRecord): Session {
  return record.actions.reduce((s, a) => act(s, a), newSession(catalog, record.config));
}
