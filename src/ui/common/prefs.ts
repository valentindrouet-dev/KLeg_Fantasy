import { create } from "zustand";
import type { SortMode } from "../game/sortCards";

// Préférences d'affichage, gardées dans le navigateur.

const KEY = "kleg-prefs";

export type { SortMode };

export type Prefs = {
  tooltipsFr: boolean; // infobulles en français
  sortPlay: SortMode; // ordre des cartes en jeu
  zoom: number; // taille des cartes en jeu (0.6 à 2), l'interface ne change pas
  dimBottom: boolean; // griser la moitié basse des cartes (stage suivant)
};

const DEFAULTS: Prefs = { tooltipsFr: true, sortPlay: "resources", zoom: 1, dimBottom: false };
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2;

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    // stockage indisponible : valeurs par défaut
  }
  return DEFAULTS;
}

function save(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignoré
  }
}

type Store = Prefs & {
  toggleTooltipsFr: () => void;
  toggleDimBottom: () => void;
  setZoom: (z: number) => void;
  setSortPlay: (m: SortMode) => void;
};

export const usePrefs = create<Store>((set, get) => {
  const update = (patch: Partial<Prefs>) => {
    const { tooltipsFr, sortPlay, zoom, dimBottom } = { ...get(), ...patch };
    const next = { tooltipsFr, sortPlay, zoom, dimBottom };
    set(next);
    save(next);
  };
  return {
    ...read(),
    toggleTooltipsFr: () => update({ tooltipsFr: !get().tooltipsFr }),
    toggleDimBottom: () => update({ dimBottom: !get().dimBottom }),
    setSortPlay: (m) => update({ sortPlay: m }),
    setZoom: (z) => update({ zoom: Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 10) / 10 }),
  };
});
