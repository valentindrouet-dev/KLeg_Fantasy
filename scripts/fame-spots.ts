// Position de l'icône de gloire « * » des étapes à gloire variable, mesurée sur les images : l'interface y écrit la
// gloire que vaut la carte maintenant (demande du 2026-10-05). Corrélation normalisée avec le gabarit de la rosette
// « * » de Strength in Numbers (#38), dans le coin haut gauche ; on garde le meilleur endroit s'il ressemble assez.
// Sortie : data/fameIcons/<extension>.json, clé « serial/stage », valeur [centre x, centre y, diamètre] en fractions
// de la largeur (x, diamètre) et de la hauteur (y) de la carte, l'étape lue à l'endroit.
//   npx tsx scripts/fame-spots.ts

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { CardTemplate } from "../src/data/schema";

const expansion = "FeudalKingdom";
const W = 373;
const H = 520;
/** Rosette de #38 : centre (40, 155), 44 px de côté pour le gabarit. */
const T = 44;
const MIN_SCORE = 0.75; // Vassal States (0,67) : grille de médailles vides, pas de « * »

async function gray(file: string, rotate: boolean): Promise<Float32Array> {
  const img = rotate ? sharp(file).rotate(180) : sharp(file);
  const { data } = await img.resize(W, H).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = 0.3 * (data[i * 3] ?? 0) + 0.59 * (data[i * 3 + 1] ?? 0) + 0.11 * (data[i * 3 + 2] ?? 0);
  return out;
}

function patch(img: Float32Array, x0: number, y0: number): Float32Array {
  const p = new Float32Array(T * T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) p[y * T + x] = img[(y0 + y) * W + x0 + x] ?? 0;
  return p;
}

/** Pixels du disque de la médaille (le fond autour change d'une carte à l'autre). */
const DISC = Array.from({ length: T * T }, (_, i) => i).filter((i) => Math.hypot((i % T) - T / 2 + 0.5, Math.floor(i / T) - T / 2 + 0.5) <= 19);

function ncc(a: Float32Array, b: Float32Array): number {
  let ma = 0;
  let mb = 0;
  for (const i of DISC) {
    ma += a[i] ?? 0;
    mb += b[i] ?? 0;
  }
  ma /= DISC.length;
  mb /= DISC.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (const i of DISC) {
    const x = (a[i] ?? 0) - ma;
    const y = (b[i] ?? 0) - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

const dir = path.join("data/cards", expansion);
const ref = await gray(path.join("data/images", expansion, "FK_Page_077.webp"), false);
const template = patch(ref, 40 - T / 2, 155 - T / 2);
const result: Record<string, number[]> = {};
const missed: string[] = [];
for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json"))) {
  const t = JSON.parse(await readFile(path.join(dir, f), "utf8")) as CardTemplate;
  for (const side of ["front", "back"] as const) {
    const src = t.images[side];
    if (!src) continue;
    for (const [stageId, rotate] of [[t.orientationToStage[`${side}-0`], false], [t.orientationToStage[`${side}-180`], true]] as const) {
      if (stageId === null || stageId === undefined) continue;
      const stage = t.stages[String(stageId) as "1"];
      if (!stage?.fameVariable) continue;
      const img = await gray(path.join("data/images", src), rotate);
      let best = { score: -1, x: 0, y: 0 };
      for (let y = 60; y <= 200 - T; y++)
        for (let x = 5; x <= 160 - T; x++) {
          const score = ncc(template, patch(img, x, y));
          if (score > best.score) best = { score, x, y };
        }
      const key = `${t.serial}/${stageId}`;
      if (best.score < MIN_SCORE) {
        missed.push(`${key} ${stage.name} (${best.score.toFixed(2)})`);
        continue;
      }
      const r = (v: number) => Math.round(v * 1000) / 1000;
      result[key] = [r((best.x + T / 2) / W), r((best.y + T / 2) / H), r(T / W)];
      console.log(key, stage.name, best.score.toFixed(2), best.x + T / 2, best.y + T / 2);
    }
  }
}
await mkdir("data/fameIcons", { recursive: true });
const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => Number.parseInt(a, 10) - Number.parseInt(b, 10) || a.localeCompare(b)));
await writeFile(`data/fameIcons/${expansion}.json`, `${JSON.stringify(sorted, null, 1)}\n`);
console.log(`${Object.keys(result).length} icônes ; sans rosette « * » : ${missed.join(", ")}`);
