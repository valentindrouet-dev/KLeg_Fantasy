// Convertit les images originales (data/raw/images, hors dépôt) en WebP versionnés (data/images).
//   npm run images            ne convertit que ce qui manque ou a changé
//   npm run images -- --force reconvertit tout

import { existsSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "data/raw/images";
const OUT = "data/images";
const force = process.argv.includes("--force");

let converted = 0;
for (const expansion of await readdir(SRC)) {
  const srcDir = path.join(SRC, expansion);
  if (!(await stat(srcDir)).isDirectory()) continue;
  const outDir = path.join(OUT, expansion);
  await mkdir(outDir, { recursive: true });
  for (const file of (await readdir(srcDir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()) {
    const src = path.join(srcDir, file);
    const out = path.join(outDir, `${path.parse(file).name}.webp`);
    if (!force && existsSync(out) && (await stat(out)).mtimeMs >= (await stat(src)).mtimeMs) continue;
    await sharp(src).webp({ quality: 85 }).toFile(out);
    converted += 1;
  }
}
console.log(`${converted} image(s) convertie(s) vers ${OUT}.`);
