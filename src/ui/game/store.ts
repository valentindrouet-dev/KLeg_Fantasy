import { create } from "zustand";
import {
  act,
  canUndo,
  current,
  resumeSession,
  undo as undoSession,
  type Action,
  type Catalog,
  type Session,
} from "../../engine";
import { getKingdom, saveKingdom } from "../../persistence/db";
import { summarize, type Kingdom } from "../../persistence/kingdoms";

// Store de l'écran de partie : session du moteur + royaume, sauvegarde automatique après chaque action.

type Toast = { id: number; text: string };

type GameStore = {
  status: "idle" | "loading" | "ready" | "missing";
  kingdom: Kingdom | null;
  session: Session | null;
  toast: Toast | null;
  load: (catalog: Catalog, id: string) => Promise<void>;
  perform: (action: Action, toast?: string) => void;
  undo: () => void;
  dismissToast: () => void;
};

let toastSeq = 0;

function persist(catalog: Catalog, kingdom: Kingdom, session: Session): Kingdom {
  const state = current(session);
  const next: Kingdom = {
    ...kingdom,
    updatedAt: Date.now(),
    record: session.record,
    state,
    summary: summarize(catalog, session.record, state),
  };
  void saveKingdom(next); // autosave (spec 6.2)
  return next;
}

export const useGame = create<GameStore>((set, get) => ({
  status: "idle",
  kingdom: null,
  session: null,
  toast: null,

  load: async (catalog, id) => {
    set({ status: "loading", kingdom: null, session: null, toast: null });
    const kingdom = await getKingdom(id);
    if (!kingdom) {
      set({ status: "missing" });
      return;
    }
    set({ status: "ready", kingdom, session: resumeSession(catalog, kingdom.record, kingdom.state) });
  },

  perform: (action, toast) => {
    const { session, kingdom } = get();
    if (!session || !kingdom) return;
    const next = act(session, action);
    set({
      session: next,
      kingdom: persist(session.catalog, kingdom, next),
      toast: toast && canUndo(next) ? { id: ++toastSeq, text: toast } : null,
    });
  },

  undo: () => {
    const { session, kingdom } = get();
    if (!session || !kingdom || !canUndo(session)) return;
    const next = undoSession(session);
    set({ session: next, kingdom: persist(session.catalog, kingdom, next), toast: null });
  },

  dismissToast: () => set({ toast: null }),
}));
