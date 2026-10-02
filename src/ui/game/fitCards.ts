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

/** Part de la hauteur d'une carte bloquée qui dépasse au-dessus de sa bloquante. */
export const BLOCKED_PEEK = 0.18;

/** Emplacement de la zone de jeu : `h` hauteurs de carte, `breakBefore` = commence une nouvelle ligne (ennemis en haut). */
export type Slot = { h: number; breakBefore?: boolean; space?: number }; // space : écart en plus devant (px)

/**
 * Plus grande largeur de carte qui fait tenir les emplacements, rangés comme le fait flex-wrap (de gauche à droite,
 * ligne suivante quand ça déborde). Un saut de ligne forcé ajoute une ligne vide (l'élément de saut), donc un écart.
 */
export function fitSlots(width: number, height: number, slots: readonly Slot[], gap: number, max: number): number {
  if (slots.length === 0 || width <= 0 || height <= 0) return max;
  const fits = (cw: number): boolean => {
    if (cw > width) return false;
    const ch = cw / CARD_ASPECT;
    const rows: number[] = [];
    let used = 0;
    let rowH = 0;
    let open = false;
    const close = () => {
      if (open) rows.push(rowH);
      used = 0;
      rowH = 0;
      open = false;
    };
    for (const s of slots) {
      if (s.breakBefore && open) {
        close();
        rows.push(0);
      }
      const extra = open ? gap + (s.space ?? 0) : 0;
      if (open && used + extra + cw > width) close();
      used += (open ? gap + (s.space ?? 0) : 0) + cw;
      rowH = Math.max(rowH, s.h * ch);
      open = true;
    }
    close();
    return rows.reduce((a, b) => a + b, 0) + gap * (rows.length - 1) <= height;
  };
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}
