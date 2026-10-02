import sharp from "sharp";

// Icônes détourées (fond transparent) tirées de la planche fournie le 2026-10-02 (data/icons/stickers-sheet.webp).
// Elles remplacent, pour les ressources et la gloire, les icônes découpées dans les cartes (extract-icons.ts).
// Relancer : npx tsx scripts/extract-sheet-icons.ts
// [nom, x0, y0, x1, y1] : boîtes trouvées par détection des zones opaques de la planche (1536 × 1024).
const ICONS: [string, number, number, number, number][] = [
  ["coin", 128, 88, 328, 292], // sticker 1
  ["wood", 520, 92, 688, 292], // 2
  ["stone", 916, 108, 1112, 288], // 3
  ["metal", 1272, 116, 1484, 292], // 4
  ["sword", 108, 384, 332, 604], // 5
  ["tradeGood", 496, 412, 740, 612], // 6
  ["staysInPlay", 852, 452, 1200, 564], // 7
  ["fame2", 1312, 372, 1488, 628], // 8
  ["fame5", 156, 708, 340, 960], // 10
  ["knight", 472, 784, 788, 876], // 11
  ["scorePath", 944, 712, 1132, 944], // 13k
  ["fame", 1300, 700, 1480, 956], // 16 : ruban vierge, sert d'icône {fame}
];
const PAD = 4;
const HEIGHT = 96;

for (const [name, x0, y0, x1, y1] of ICONS) {
  await sharp("data/icons/stickers-sheet.webp")
    .extract({ left: x0 - PAD, top: y0 - PAD, width: x1 - x0 + 2 * PAD, height: y1 - y0 + 2 * PAD })
    .resize({ height: HEIGHT, kernel: "lanczos3" })
    .png()
    .toFile(`src/ui/icons/${name}.png`);
}
console.log(`${ICONS.length} icônes écrites dans src/ui/icons/`);
