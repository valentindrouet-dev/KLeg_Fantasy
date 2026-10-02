import type { Stage } from "../../data/schema";

// Où dessiner les stickers d'un stage (demande du 2026-10-02) : dans la rangée des ressources imprimées, sous le
// bandeau, juste après la dernière icône, à la même taille. Repères relevés sur les images (373 × 520), carte à
// l'endroit, moitié haute : première icône à x = 4,5 %, rangée à y = 13,7 %, icônes de 11,8 % de large, pas de 12,9 %,
// « / » de 6 % entre deux options. Calcul pur, testé côté Node.

export const STICKER_SIZE = 0.118; // largeur, en fraction de la largeur de la carte
const START_X = 0.045;
const ROW_Y = 0.137;
const STEP = 0.129;
const SLASH = 0.06;
const RIGHT = 0.97;
const SECOND_ROW = { x: 0.2, y: 0.25 }; // à droite de la gloire imprimée, si la rangée est pleine

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
