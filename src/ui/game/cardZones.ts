// Zones cliquables d'une carte (demande du 2026-10-02) : la moitié haute montre le stage actif.
// Repères relevés sur les images (373 × 520) : production à gauche sous le bandeau, boîte d'amélioration
// « → » en haut à droite, boîte « ↓ » à droite contre la ligne du milieu, texte d'effet au centre bas.

export type ZoneKind = "production" | "upgradeFlip" | "upgradeRotate" | "effect" | "other" | "bottom";

/** x, y : position relative dans la carte (0..1, origine en haut à gauche, carte affichée à l'endroit). */
export function zoneAt(x: number, y: number): ZoneKind {
  if (y >= 0.5) return "bottom";
  const h = y / 0.5; // position dans la moitié haute
  if (x >= 0.76 && h < 0.45) return "upgradeFlip";
  if (x >= 0.7 && h >= 0.68) return "upgradeRotate";
  if (h >= 0.22 && h < 0.62 && x < 0.76) return "production";
  if (h >= 0.62 && x < 0.7) return "effect";
  return "other";
}

/** Rectangle d'une zone, en fractions de la carte (pour la surbrillance). */
export const ZONE_RECTS: Record<Exclude<ZoneKind, "other" | "bottom">, { left: number; top: number; width: number; height: number }> = {
  production: { left: 0, top: 0.11, width: 0.76, height: 0.2 },
  upgradeFlip: { left: 0.76, top: 0, width: 0.24, height: 0.225 },
  upgradeRotate: { left: 0.7, top: 0.34, width: 0.3, height: 0.16 },
  effect: { left: 0, top: 0.31, width: 0.7, height: 0.19 },
};

/**
 * Zone d'une carte à image pleine (une étape par face) : le texte de l'effet est dans la moitié basse, toute la
 * moitié basse sert donc à l'effet ; le haut garde la ressource et les flèches d'amélioration.
 */
export function zoneAtCard(x: number, y: number, fullImage: boolean): ZoneKind {
  const zone = zoneAt(x, y);
  if (!fullImage) return zone;
  if (zone === "bottom") return "effect";
  return zone === "effect" ? "other" : zone;
}

/** Rectangle de la zone d'effet d'une carte à image pleine. */
export const FULL_IMAGE_EFFECT_RECT = { left: 0.05, top: 0.52, width: 0.9, height: 0.4 };
