import { applyAction } from "./actions";
import { createGame } from "./setup";
import type { Action, Catalog, GameConfig, GameState } from "./types";

// Event sourcing (spec 4.1 et 6.2) : une partie = configuration + liste d'actions.
// La session garde les états des dernières actions pour annuler sans rejouer ;
// au-delà, l'annulation (mode Libre) rejoue l'enregistrement.

/**
 * undoFloor : nombre d'actions en dessous duquel on ne peut plus annuler, quel que soit le mode (fin d'une purge,
 * demande du 2026-10-05). Absent des parties enregistrées avant : aucune limite.
 */
export type GameRecord = { config: GameConfig; actions: Action[]; undoFloor?: number };

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
  const before = current(session);
  const next = applyAction(session.catalog, before, action);
  const actions = [...session.record.actions, action];
  // Purge terminée (des cartes viennent d'être purgées) : elle ne s'annule plus, même en mode Libre.
  const purged = (next.zones.purged?.length ?? 0) !== (before.zones.purged?.length ?? 0);
  return {
    ...session,
    record: { ...session.record, actions, ...(purged ? { undoFloor: actions.length } : {}) },
    states: [...session.states, next].slice(-(UNDO_WINDOW + 1)),
  };
}

/**
 * Mode Libre : on peut toujours annuler. Mode Strict : seulement une action du tour en cours
 * qui n'a révélé aucune information (carte du deck, découverte, mélange).
 */
export function canUndo(session: Session): boolean {
  if (session.record.actions.length <= (session.record.undoFloor ?? 0)) return false;
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

/**
 * Rejoue une partie enregistrée (import, annulation au-delà de la fenêtre). Les parties enregistrées avant la
 * fenêtre « Nouvelles cartes » (v0.20) n'ont pas l'action qui la ferme : elle est ajoutée au passage.
 */
export function replay(catalog: Catalog, record: GameRecord): Session {
  return record.actions.reduce((s, a) => {
    const pending = current(s).pending;
    const next = pending?.kind === "newCards" && a.type !== "acknowledgeDiscoveries" ? act(s, { type: "acknowledgeDiscoveries" }) : s;
    // Avant la v0.35, toute carte à flèches rouges faisait choisir sa face : ce choix n'existe plus hors parchemin 37.
    if (a.type === "chooseSide" && current(next).pending?.kind !== "chooseSide") return next;
    return act(next, a);
  }, newSession(catalog, record.config));
}

// --- Recommencer la dernière extension (demande du 2026-10-06) ---

const startsExpansion = (a: Action): boolean => a.type === "startExpansion" || a.type === "startGrandExpansion";

/** Rang de l'action qui a lancé la dernière extension (mini ou grande), ou -1. */
export function lastExpansionStart(record: GameRecord): number {
  for (let i = record.actions.length - 1; i >= 0; i--) {
    const a = record.actions[i];
    if (a && startsExpansion(a)) return i;
  }
  return -1;
}

/** État gardé au lancement d'une extension (Kingdom.expansionSnapshot) : `actions` actions avant le lancement. */
export type ExpansionSnapshot = { actions: number; state: GameState; undoFloor?: number };

/** On peut recommencer la dernière extension jouée, finie ou en cours ; jamais une plus ancienne (pas d'embranchement). */
export function canRestartLastExpansion(record: GameRecord): boolean {
  return lastExpansionStart(record) >= 0;
}

/**
 * La partie juste avant le lancement de la dernière extension : depuis l'état gardé à son lancement s'il lui correspond
 * (immédiat, sans rejouer), sinon en rejouant l'enregistrement jusque-là. null s'il n'y a pas d'extension lancée.
 */
export function beforeLastExpansion(catalog: Catalog, record: GameRecord, snapshot?: ExpansionSnapshot): Session | null {
  const i = lastExpansionStart(record);
  if (i < 0) return null;
  const actions = record.actions.slice(0, i);
  if (snapshot && snapshot.actions === i) {
    return resumeSession(catalog, { config: record.config, actions, ...(snapshot.undoFloor !== undefined ? { undoFloor: snapshot.undoFloor } : {}) }, snapshot.state);
  }
  return replay(catalog, { config: record.config, actions });
}
