// Planches de lecture pour l'extraction visuelle : chaque face à l'endroit et, si elle porte
// deux stages, retournée à 180° à côté. Sortie dans data/raw/sheets (hors dépôt).
//   npx tsx scripts/stage-sheets.ts --from 1 --to 10

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { RawCardSchema } from "../src/data/rawSchema";

const arg = (flag: string, fallback: number) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const expansion = "FeudalKingdom";
const W = 560;
const H = 780;
const outDir = path.join("data/raw/sheets", expansion);
await mkdir(outDir, { recursive: true });

for (let n = arg("--from", 0); n <= arg("--to", 139); n += 1) {
  const raw = RawCardSchema.parse(JSON.parse(await readFile(`data/raw/${expansion}/${n}.json`, "utf8")));
  // Ligne 1 : recto (stage 1, puis stage 2 retourné). Ligne 2 : verso (stage 3 retourné, puis stage 4).
  const tiles: { input: Buffer; left: number; top: number }[] = [];
  for (const [row, side] of (["front", "back"] as const).entries()) {
    const src = raw.images[side];
    if (!src) continue;
    const file = path.join("data/raw/images", expansion, path.basename(src));
    const upright = await sharp(file).resize(W, H, { fit: "fill" }).toBuffer();
    const rotated = await sharp(upright).rotate(180).toBuffer();
    const two = raw.sides[side].length > 1;
    const line = side === "front" ? [upright, ...(two ? [rotated] : [])] : [...(two ? [rotated] : []), upright];
    line.forEach((input, col) => tiles.push({ input, left: col * W, top: row * H }));
  }
  await sharp({ create: { width: W * 2, height: H * 2, channels: 3, background: "#ffffff" } })
    .composite(tiles)
    .jpeg({ quality: 88 })
    .toFile(path.join(outDir, `${n}.jpg`));
}
