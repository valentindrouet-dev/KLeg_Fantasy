// Calcul pur (sans DOM) de la taille des cartes en jeu, testé côté Node.

export const CARD_ASPECT = 373 / 520;

export function fitCardWidth(width: number, height: number, count: number, gap: number, max: number): number {
  if (count === 0 || width <= 0 || height <= 0) return max;
  let best = 0;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const w = Math.min((width - gap * (cols - 1)) / cols, ((height - gap * (rows - 1)) / rows) * CARD_ASPECT);
    best = Math.max(best, w);
  }
  return Math.floor(Math.min(best, max));
}
