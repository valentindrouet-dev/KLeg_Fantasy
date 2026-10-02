import { create } from "zustand";

// Préférences d'affichage, gardées dans le navigateur.

const KEY = "kleg-prefs";

export type Prefs = {
  tooltipsFr: boolean; // infobulles en français
  zoom: number; // échelle de l'interface (0.8 à 1.6)
  dimBottom: boolean; // griser la moitié basse des cartes (stage suivant)
};

const DEFAULTS: Prefs = { tooltipsFr: true, zoom: 1, dimBottom: false };
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 1.6;

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

/** Applique l'échelle à toute l'appli (tailles en rem et variables de thème). */
export function applyZoom(zoom: number): void {
  document.documentElement.style.setProperty("--zoom", String(zoom));
}

type Store = Prefs & {
  toggleTooltipsFr: () => void;
  toggleDimBottom: () => void;
  setZoom: (z: number) => void;
};

export const usePrefs = create<Store>((set, get) => {
  const update = (patch: Partial<Prefs>) => {
    const { tooltipsFr, zoom, dimBottom } = { ...get(), ...patch };
    const next = { tooltipsFr, zoom, dimBottom };
    set(next);
    save(next);
    applyZoom(next.zoom);
  };
  return {
    ...read(),
    toggleTooltipsFr: () => update({ tooltipsFr: !get().tooltipsFr }),
    toggleDimBottom: () => update({ dimBottom: !get().dimBottom }),
    setZoom: (z) => update({ zoom: Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 10) / 10 }),
  };
});
