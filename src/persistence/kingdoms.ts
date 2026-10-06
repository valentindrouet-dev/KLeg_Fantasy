import { campaignStage, campaignSteps, computeScore, type CampaignStage, type Catalog, type ExpansionSnapshot, type GameRecord, type GameState } from "../engine";

// Royaumes (spec 6.1) : une partie indépendante, avec sa propre boîte de cartes.
// Le royaume stocke l'enregistrement (config + actions) et le dernier état, pour reprendre sans rejouer.

export type KingdomSummary = {
  round: number;
  turn: number;
  fame: number;
  lastDiscovered: number | null;
  /** Partie de base finie (ancien statut, gardé tel quel) ; le royaume, lui, n'est jamais clôturé : voir `stage`. */
  status: "playing" | "finished";
  actions: number;
  /** Où en est la campagne (absent des résumés enregistrés avant la v0.57 : recalculé depuis l'état). */
  stage?: CampaignStage;
};

export type Kingdom = {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
  updatedAt: number;
  summary: KingdomSummary;
  record: GameRecord;
  state: GameState;
  /** Objectifs du joueur (demande du 2026-10-04) : étapes de cartes à atteindre, entourées en doré. */
  goals?: Goal[];
  /** Cartes « rayées » (halo rouge) : le joueur n'en a plus l'usage et peut les détruire ou purger (demande du 2026-10-04). */
  unwanted?: string[];
  /** Temps de jeu (ms), compté seulement quand l'appli est à l'écran (demande du 2026-10-04). */
  playMs?: number;
  /**
   * Fin de chaque étape de la campagne (« base », puis numéro de la mini-extension) : date et temps de jeu cumulé à ce
   * moment, pour le tableau des scores (demande du 2026-10-05). Absent des étapes finies avant la v0.57.
   */
  milestones?: Milestone[];
  /**
   * État juste avant le lancement de la dernière extension (demande du 2026-10-06) : « Recommencer la dernière
   * extension » y revient sans rejouer toute la partie. Absent des extensions lancées avant la v0.67 (on rejoue alors).
   */
  expansionSnapshot?: ExpansionSnapshot;
};

export type Milestone = { step: string; at: number; playMs: number };

/** Jalons à jour : les étapes qui viennent de finir sont ajoutées, celles défaites par une annulation retirées. */
export function updateMilestones(catalog: Catalog, k: Kingdom, state: GameState, now: number): Milestone[] | undefined {
  const done = campaignSteps(catalog, state)
    .filter((x) => x.status === "done")
    .map((x) => x.id);
  const kept = (k.milestones ?? []).filter((m) => done.includes(m.step));
  const known = new Set((k.milestones ?? []).map((m) => m.step));
  // Une étape finie avant la v0.57 n'a pas de jalon : on n'en invente pas (ni date ni durée), sauf si elle vient de finir.
  const before = k.state ? campaignSteps(catalog, k.state).filter((x) => x.status === "done").map((x) => x.id) : [];
  const fresh = done.filter((id) => !known.has(id) && !before.includes(id)).map((step) => ({ step, at: now, playMs: k.playMs ?? 0 }));
  const next = [...kept, ...fresh];
  return next.length || k.milestones ? next : undefined;
}

/** Durée de jeu lisible : « 42 min », « 1 h 05 ». */
export function formatPlayTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

export type Goal = { card: string; stage: 1 | 2 | 3 | 4 };

export function summarize(catalog: Catalog, record: GameRecord, state: GameState): KingdomSummary {
  return {
    round: state.round,
    turn: state.turn,
    fame: computeScore(catalog, state).total,
    lastDiscovered: state.discoveries.at(-1) ?? null,
    status: state.phase === "gameOver" ? "finished" : "playing",
    actions: record.actions.length,
    stage: campaignStage(state, catalog),
  };
}

export function newKingdomId(): string {
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const PREFIXES = ["Val", "Haute", "Roche", "Bois", "Mont", "Clair", "Fort", "Pierre", "Lune", "Brume", "Aube", "Chêne", "Or", "Corbeau"];
const SUFFIXES = ["ombre", "garde", "fleur", "mont", "castel", "rive", "lande", "val", "bourg", "pré", "fontaine", "marche"];

/** Nom médiéval aléatoire pour un nouveau royaume. */
export function randomKingdomName(rand: () => number = Math.random): string {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const name = `${pick(PREFIXES)}${pick(SUFFIXES)}`;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export const KINGDOM_EMOJIS = ["🏰", "👑", "🛡️", "⚔️", "🐉", "🦁", "🦅", "🐺", "🌲", "⛰️", "🌾", "⚓", "🍷", "🔥", "🌙", "⭐"];
