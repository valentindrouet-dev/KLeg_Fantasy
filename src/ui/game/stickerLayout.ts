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

export type StickerSpot = { left: number; top: number; size?: number }; // fractions de la carte, moitié haute à l'endroit ; size : largeur (STICKER_SIZE par défaut)

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

// Stickers de gloire (demande du 2026-10-05) : sur la ligne de la rosette de gloire imprimée, juste après elle, à sa
// taille. Repères relevés sur les images (373 × 520) : rosette de 44 px, centre à x = 40, pas de 42 px entre deux
// rosettes (Camelot, The Ark) ; centre à y = 155 sous une rangée de ressources, 100 sans ressources.
export const FAME_STICKER_SIZE = 44 / 373;
const FAME_X = 40;
const FAME_STEP = 42;

/**
 * Places des `count` stickers de gloire d'une étape. `measured` : centre mesuré de la rosette « * » (gloire variable,
 * data/fameIcons), la dernière rosette imprimée quand elle existe.
 */
export function fameStickerSpots(stage: Stage | undefined, count: number, measured?: readonly [number, number, number]): StickerSpot[] {
  const printed = (stage && stage.fame > 0 ? 1 : 0) + (stage?.fameVariable ? 1 : 0);
  const hasProduction = (stage?.production ?? []).length > 0;
  let cx = measured ? measured[0] * 373 + FAME_STEP : FAME_X + printed * FAME_STEP;
  const cy = measured ? measured[1] * 520 : hasProduction ? 155 : 100;
  const spots: StickerSpot[] = [];
  for (let i = 0; i < count; i++) {
    spots.push({ left: (cx - 22) / 373, top: (cy - 22) / 520, size: FAME_STICKER_SIZE });
    cx += FAME_STEP + 4; // deux stickers posés côte à côte ne se chevauchent pas
  }
  return spots;
}
