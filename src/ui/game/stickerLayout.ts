import type { Stage } from "../../data/schema";

// Où dessiner les stickers d'un stage (demande du 2026-10-02) : dans la rangée des ressources imprimées, sous le
// bandeau, juste après la dernière icône, à la même taille. Repères relevés sur les images (373 × 520), carte à
// l'endroit, moitié haute (remesurés le 2026-10-04 sur Farmlands, Festival, Tavern : même gabarit partout) : première
// icône de x = 19,5 à 69,5 px, haut à y = 79 px, icônes de 50 px au pas de 53,6 px, « / » de 31 px en plus entre deux
// options. Calcul pur, testé côté Node.

export const STICKER_SIZE = 50 / 373; // largeur, en fraction de la largeur de la carte
const START_X = 19.5 / 373;
const ROW_Y = 79 / 520;
const STEP = 53.6 / 373;
const SLASH = 31 / 373;
const RIGHT = 0.97;
const SECOND_ROW = { x: START_X + STEP, y: (79 + 56) / 520 }; // à droite de la gloire imprimée, si la rangée est pleine

export type StickerSpot = { left: number; top: number }; // fractions de la carte, moitié haute à l'endroit

/** Places des `count` stickers d'un stage, après ses ressources imprimées. */
export function stickerSpots(stage: Stage | undefined, count: number): StickerSpot[] {
  let x = START_X;
  for (const g of stage?.production ?? []) {
    g.options.forEach((o, i) => {
      if (i > 0) x += SLASH;
      x += o.length * STEP;
    });
  }
  const spots: StickerSpot[] = [];
  let y = ROW_Y;
  for (let i = 0; i < count; i++) {
    if (x + STICKER_SIZE > RIGHT && y === ROW_Y) {
      x = SECOND_ROW.x;
      y = SECOND_ROW.y;
    }
    spots.push({ left: x, top: y });
    x += STEP;
  }
  return spots;
}
