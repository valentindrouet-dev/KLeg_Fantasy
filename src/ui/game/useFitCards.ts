import { useCallback, useEffect, useState } from "react";
import { fitCardWidth } from "./fitCards";

// Taille des cartes de la zone de jeu : la plus grande qui fait tenir toutes les cartes sans défilement (spec 7.3).
// Renvoie une ref à poser sur la zone (ref de rappel : la zone peut apparaître après le chargement).

/**
 * `zoom` : taille des cartes en jeu. On calcule la taille qui tient (en réservant la largeur), puis on la multiplie :
 * au-delà de 100 %, les cartes passent sur plus de rangées et la zone de jeu défile verticalement.
 */
export function useFitCards(count: number, zoom = 1, gap = 12, max = 300): [(el: HTMLElement | null) => void, number] {
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
  if (size.width <= 0) return [ref, 0];
  return [ref, Math.floor(fitCardWidth(size.width / zoom, size.height, count, gap, max) * zoom)];
}
