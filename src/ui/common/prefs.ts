import { create } from "zustand";

// Préférences d'affichage, gardées dans le navigateur.

const KEY = "kleg-prefs";

type Prefs = { tooltipsFr: boolean };

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { tooltipsFr: true, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    // stockage indisponible : valeurs par défaut
  }
  return { tooltipsFr: true };
}

export const usePrefs = create<Prefs & { toggleTooltipsFr: () => void }>((set, get) => ({
  ...read(),
  toggleTooltipsFr: () => {
    const next = { tooltipsFr: !get().tooltipsFr };
    set(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignoré
    }
  },
}));
