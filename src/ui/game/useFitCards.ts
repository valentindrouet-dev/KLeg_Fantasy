import { useCallback, useEffect, useState } from "react";
import { fitSlots, type Slot } from "./fitCards";

// Taille des cartes de la zone de jeu : la plus grande qui fait tenir toutes les cartes sans défilement (spec 7.3).
// Renvoie une ref à poser sur la zone (ref de rappel : la zone peut apparaître après le chargement).

/**
 * Taille de la zone de jeu (ref de rappel : la zone peut apparaître après le chargement). La taille des cartes se calcule
 * ensuite avec `fitSlots` ; au-delà de 100 % de zoom, les cartes passent sur plus de rangées et la zone défile.
 */
export function useFitArea(): [(el: HTMLElement | null) => void, { width: number; height: number }] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  const ref = useCallback((node: HTMLElement | null) => setEl(node), []);
  return [ref, size];
}

/** Largeur des cartes pour ces emplacements, zoom compris (0 tant que la zone n'est pas mesurée). */
export function cardWidthFor(area: { width: number; height: number }, slots: readonly Slot[], zoom = 1, gap = 12, max = 300): number {
  if (area.width <= 0) return 0;
  return Math.floor(fitSlots(area.width / zoom, area.height, slots, gap, max) * zoom);
}
