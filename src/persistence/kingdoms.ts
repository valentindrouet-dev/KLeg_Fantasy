import { computeScore, type Catalog, type GameRecord, type GameState } from "../engine";

// Royaumes (spec 6.1) : une partie indépendante, avec sa propre boîte de cartes.
// Le royaume stocke l'enregistrement (config + actions) et le dernier état, pour reprendre sans rejouer.

export type KingdomSummary = {
  round: number;
  turn: number;
  fame: number;
  lastDiscovered: number | null;
  status: "playing" | "finished";
  actions: number;
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
};

export function summarize(catalog: Catalog, record: GameRecord, state: GameState): KingdomSummary {
  return {
    round: state.round,
    turn: state.turn,
    fame: computeScore(catalog, state).total,
    lastDiscovered: state.discoveries.at(-1) ?? null,
    status: state.phase === "gameOver" ? "finished" : "playing",
    actions: record.actions.length,
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
