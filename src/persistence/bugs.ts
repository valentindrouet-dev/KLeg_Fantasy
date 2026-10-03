import { getDb } from "./db";

// Bugs signalés depuis l'appli (bouton « bug » de la barre du haut) : gardés dans IndexedDB, puis partagés en un
// fichier JSON. Chaque bug emporte de quoi le rejouer : l'enregistrement de la partie (config + actions), comme
// une sauvegarde de royaume, et l'état de l'écran au moment du signalement.

export const BUGS_FORMAT = "kleg-fantasy-bugs";

export type BugReport = {
  id: string;
  createdAt: number;
  text: string;
  appVersion: string;
  /** Écran, appareil, adresse dans l'appli. */
  device: { screen: string; userAgent: string; route: string };
  /** Partie en cours, si le bug est signalé pendant une partie. */
  game?: {
    kingdom: { id: string; name: string; record: unknown };
    /** État du moteur au signalement (le rejeu de l'enregistrement peut différer si le moteur a changé depuis). */
    state: unknown;
    where: string;
    /** Ce qui était ouvert ou en cours à l'écran (carte choisie, paiement, fenêtre…). */
    screen: Record<string, unknown>;
    log: string[];
  };
};

export async function listBugs(): Promise<BugReport[]> {
  return getDb().bugs.orderBy("createdAt").toArray();
}

export async function addBug(bug: BugReport): Promise<void> {
  await getDb().bugs.put(bug);
}

export async function deleteBug(id: string): Promise<void> {
  await getDb().bugs.delete(id);
}

export function newBugId(): string {
  return `bug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Fichier de partage : tous les bugs enregistrés. */
export function exportBugs(bugs: readonly BugReport[], appVersion: string): string {
  return JSON.stringify({ format: BUGS_FORMAT, appVersion, exportedAt: new Date().toISOString(), bugs }, null, 1);
}

export function bugsFileName(): string {
  return `bugs-kleg-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}.json`;
}
