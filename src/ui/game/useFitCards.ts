import { useCallback, useEffect, useState } from "react";
import { fitCardWidth } from "./fitCards";

// Taille des cartes de la zone de jeu : la plus grande qui fait tenir toutes les cartes sans défilement (spec 7.3).
// Renvoie une ref à poser sur la zone (ref de rappel : la zone peut apparaître après le chargement).

/**
 * `zoom` : les cartes suivent le zoom de l'interface. La barre, les ressources et les boutons grossissent aussi et
 * prennent de la hauteur ; on calcule donc la taille comme à 100 % (hauteur rendue à la zone), puis on la multiplie.
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
  const chrome = Math.max(0, window.innerHeight - size.height); // hauteur prise par le reste de l'écran
  const heightAt100 = window.innerHeight - chrome / zoom;
  return [ref, Math.floor(fitCardWidth(size.width / zoom, heightAt100, count, gap, max) * zoom)];
}
