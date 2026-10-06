import { create } from "zustand";
import {
  act,
  beforeLastExpansion,
  canUndo,
  current,
  newSession,
  randomSeed,
  refreshPendingPrompt,
  resumeSession,
  undo as undoSession,
  type Action,
  type Catalog,
  type GameState,
  type InstanceId,
  type Session,
} from "../../engine";
import type { StageId } from "../../data/schema";
import { getKingdom, saveKingdom } from "../../persistence/db";
import { summarize, updateMilestones, type Kingdom } from "../../persistence/kingdoms";
import { goalOpen } from "./goals";

// Store de l'écran de partie : session du moteur + royaume, sauvegarde automatique après chaque geste.
// Les cartes « engagées » (ressource réservée, pas encore produite) ne vivent que dans l'interface :
// elles ne produisent qu'au paiement (voir planWithEngaged).

type Toast = { id: number; text: string };

type GameStore = {
  status: "idle" | "loading" | "ready" | "missing";
  kingdom: Kingdom | null;
  session: Session | null;
  toast: Toast | null;
  engaged: InstanceId[];
  /** Cartes marquées d'un drapeau (toucher à deux doigts) ; le drapeau tombe quand la carte quitte le jeu. */
  flagged: InstanceId[];
  /** Nombre d'actions du moteur par geste du joueur, pour annuler un geste d'un coup. */
  groups: number[];
  load: (catalog: Catalog, id: string) => Promise<void>;
  perform: (actions: Action[], toast?: string) => void;
  toggleEngaged: (card: InstanceId) => void;
  toggleFlag: (card: InstanceId) => void;
  /** Marque (ou retire) une étape de carte comme objectif, gardé avec le royaume. */
  toggleGoal: (card: InstanceId, stage: StageId) => void;
  /** Raye (ou dé-raye) une carte : halo rouge, carte dont le joueur n'a plus l'usage. */
  toggleUnwanted: (card: InstanceId) => void;
  /** Ajoute du temps de jeu au royaume (chronomètre), sauvegardé. */
  addPlayTime: (ms: number) => void;
  /** Reset officiel (avant la carte 23) : le royaume repart des cartes 1 à 10, nouveau mélange. */
  restart: () => void;
  /** Revenir juste avant le lancement de la dernière extension (demande du 2026-10-06). Renvoie un message d'erreur, ou null. */
  restartLastExpansion: () => string | null;
  undo: () => void;
  dismissToast: () => void;
};

let toastSeq = 0;

function persist(catalog: Catalog, kingdom: Kingdom, session: Session): Kingdom {
  const state = current(session);
  const next: Kingdom = {
    ...kingdom,
    // Objectif atteint (carte construite jusqu'à cette étape) ou carte sortie du royaume : il tombe.
    ...(kingdom.goals ? { goals: kingdom.goals.filter((g) => goalOpen(catalog, state, g)) } : {}),
    // Fin d'une étape de la campagne : date et temps de jeu (tableau des scores).
    ...(() => {
      const milestones = updateMilestones(catalog, kingdom, state, Date.now());
      return milestones ? { milestones } : {};
    })(),
    // Carte rayée détruite, purgée ou rendue à la boîte : la marque tombe.
    ...(kingdom.unwanted ? { unwanted: kingdom.unwanted.filter((id) => inKingdom(state, id)) } : {}),
    updatedAt: Date.now(),
    record: session.record,
    state,
    summary: summarize(catalog, session.record, state),
  };
  void saveKingdom(next); // autosave (spec 6.2)
  return next;
}

const inKingdom = (s: GameState, id: InstanceId): boolean =>
  [s.zones.deck, s.zones.play, s.zones.discard, s.zones.permanent, s.zones.blocked].some((z) => z.includes(id));

/** Les engagements tombent quand la carte quitte le jeu ou qu'un nouveau tour commence. */
function keepEngaged(engaged: InstanceId[], before: GameState, after: GameState): InstanceId[] {
  if (before.round !== after.round || before.turn !== after.turn) return [];
  return engaged.filter((id) => after.zones.play.includes(id));
}

export const useGame = create<GameStore>((set, get) => ({
  status: "idle",
  kingdom: null,
  session: null,
  toast: null,
  engaged: [],
  flagged: [],
  groups: [],

  load: async (catalog, id) => {
    set({ status: "loading", kingdom: null, session: null, toast: null, engaged: [], flagged: [], groups: [] });
    const kingdom = await getKingdom(id);
    if (!kingdom) {
      set({ status: "missing" });
      return;
    }
    // Question en attente : reformulée avec le texte de la version actuelle.
    set({ status: "ready", kingdom, session: resumeSession(catalog, kingdom.record, refreshPendingPrompt(catalog, kingdom.state)) });
  },

  perform: (actions, toast) => {
    const { session, kingdom, engaged, flagged, groups } = get();
    if (!session || !kingdom || actions.length === 0) return;
    const next = actions.reduce((s, a) => act(s, a), session);
    const inPlay = current(next).zones.play;
    // Lancement d'une extension : l'état d'avant est gardé, pour pouvoir la recommencer sans tout rejouer.
    const starts = actions.findIndex((a) => a.type === "startExpansion" || a.type === "startGrandExpansion");
    const before = starts < 0 ? null : actions.slice(0, starts).reduce((s, a) => act(s, a), session);
    const base: Kingdom = before
      ? { ...kingdom, expansionSnapshot: { actions: before.record.actions.length, state: current(before), ...(before.record.undoFloor !== undefined ? { undoFloor: before.record.undoFloor } : {}) } }
      : kingdom;
    set({
      flagged: flagged.filter((id) => inPlay.includes(id)),
      session: next,
      kingdom: persist(session.catalog, base, next),
      engaged: keepEngaged(engaged, current(session), current(next)),
      groups: [...groups, actions.length],
      toast: toast && canUndo(next) ? { id: ++toastSeq, text: toast } : null,
    });
  },

  toggleFlag: (card) =>
    set(({ flagged }) => ({ flagged: flagged.includes(card) ? flagged.filter((c) => c !== card) : [...flagged, card] })),

  toggleGoal: (card, stage) => {
    const { kingdom } = get();
    if (!kingdom) return;
    const goals = kingdom.goals ?? [];
    const has = goals.some((g) => g.card === card && g.stage === stage);
    const next: Kingdom = { ...kingdom, goals: has ? goals.filter((g) => !(g.card === card && g.stage === stage)) : [...goals, { card, stage }] };
    void saveKingdom(next);
    set({ kingdom: next });
  },

  toggleUnwanted: (card) => {
    const { kingdom } = get();
    if (!kingdom) return;
    const list = kingdom.unwanted ?? [];
    const next: Kingdom = { ...kingdom, unwanted: list.includes(card) ? list.filter((c) => c !== card) : [...list, card] };
    void saveKingdom(next);
    set({ kingdom: next });
  },

  addPlayTime: (ms) => {
    const { kingdom } = get();
    if (!kingdom || ms <= 0) return;
    const next: Kingdom = { ...kingdom, playMs: (kingdom.playMs ?? 0) + ms };
    void saveKingdom(next);
    set({ kingdom: next });
  },

  toggleEngaged: (card) =>
    set(({ engaged }) => ({ engaged: engaged.includes(card) ? engaged.filter((c) => c !== card) : [...engaged, card] })),

  restart: () => {
    const { session, kingdom } = get();
    if (!session || !kingdom) return;
    const fresh = newSession(session.catalog, { ...session.record.config, seed: randomSeed() });
    set({ session: fresh, kingdom: persist(session.catalog, kingdom, fresh), engaged: [], groups: [], toast: null });
  },

  restartLastExpansion: () => {
    const { session, kingdom } = get();
    if (!session || !kingdom) return "Aucune partie ouverte";
    let next: Session | null;
    try {
      next = beforeLastExpansion(session.catalog, session.record, kingdom.expansionSnapshot);
    } catch {
      return "Cette partie, commencée avec une version plus ancienne, ne peut pas être rejouée jusqu'au lancement de l'extension.";
    }
    if (!next) return "Aucune extension à recommencer";
    set({ session: next, kingdom: persist(session.catalog, kingdom, next), engaged: [], flagged: [], groups: [], toast: null });
    return null;
  },

  undo: () => {
    const { session, kingdom, groups } = get();
    if (!session || !kingdom || !canUndo(session)) return;
    let next = session;
    const count = groups.at(-1) ?? 1;
    try {
      for (let i = 0; i < count && canUndo(next); i++) next = undoSession(next);
    } catch {
      // Partie commencée avec une version aux règles différentes : la rejouer n'est plus possible.
      return;
    }
    set({
      session: next,
      kingdom: persist(session.catalog, kingdom, next),
      groups: groups.slice(0, -1),
      engaged: [],
      toast: null,
    });
  },

  dismissToast: () => set({ toast: null }),
}));
