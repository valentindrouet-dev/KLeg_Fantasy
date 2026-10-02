import sharp from "sharp";

// Icônes du jeu découpées dans les encadrés de texte des images de cartes (fond clair, taille d'origine ~24 px),
// pour les bulles et l'interface. Relancer : npx tsx scripts/extract-icons.ts
// [nom, page de l'image, image tournée de 180°, x centre, y centre]
const ICONS: [string, number, boolean, number, number][] = [
  ["activated", 21, false, 55, 215], // Trader : ✓ vert
  ["coin", 21, false, 138, 213], // Trader : pièce
  ["wood", 21, false, 231, 213], // Trader : bois
  ["stone", 22, true, 207, 223], // Market : pierre
  ["metal", 22, true, 243, 223], // Market : métal
  ["sword", 51, false, 176, 191], // Army : épée
  ["tradeGood", 55, false, 147, 184], // Export : marchandise
  ["time", 51, false, 65, 188], // Army : sablier
  ["passive", 55, false, 60, 183], // Export : ∞
  ["mark", 51, false, 226, 213], // Army : case à cocher
  ["destroy", 16, false, 157, 198], // Sacred Well : détruire
];
const SIZE = 24;

for (const [name, page, rotated, x, y] of ICONS) {
  let img = sharp(`data/images/FeudalKingdom/FK_Page_${String(page).padStart(3, "0")}.webp`);
  if (rotated) img = sharp(await img.rotate(180).toBuffer());
  await img
    .extract({ left: x - SIZE / 2, top: y - SIZE / 2, width: SIZE, height: SIZE })
    .resize(SIZE * 2, SIZE * 2, { kernel: "lanczos3" })
    .png()
    .toFile(`src/ui/icons/${name}.png`);
}
console.log(`${ICONS.length} icônes écrites dans src/ui/icons/`);
