import { useCallback, useEffect, useState } from "react";
import { fitCardWidth } from "./fitCards";

// Taille des cartes de la zone de jeu : la plus grande qui fait tenir toutes les cartes sans défilement (spec 7.3).
// Renvoie une ref à poser sur la zone (ref de rappel : la zone peut apparaître après le chargement).

export function useFitCards(count: number, gap = 12, max = 300): [(el: HTMLElement | null) => void, number] {
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
  return [ref, size.width > 0 ? fitCardWidth(size.width, size.height, count, gap, max) : 0];
}
