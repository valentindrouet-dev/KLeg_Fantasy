// Position des icônes de production de chaque étape, mesurée sur les images (pour dessiner une croix sur une production
// rayée : Royal Decree, Attack, Grapes…). Les icônes sont en haut à gauche de l'étape, en rangée, les options séparées
// par « / ». Chaque icône attendue (fiche : groupes, options, icônes) est cherchée près de sa place habituelle par
// corrélation avec l'icône de sa ressource, découpée sur une carte de référence.
// Sortie : data/productionIcons/<extension>.json, clé « serial/stage », valeur [gauche, haut, largeur, hauteur] en
// fractions de la carte (étape lue à l'endroit), une par icône imprimée, dans l'ordre groupe → option → icône.
//   npx tsx scripts/production-spots.ts [--expansion Merchants] [--only 5,11] [--sheet]
//   (--sheet : planches de contrôle dans data/raw/sheets/production)

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { CardTemplate } from "../src/data/schema";

const expansionArg = process.argv.indexOf("--expansion");
const expansion = expansionArg >= 0 ? (process.argv[expansionArg + 1] ?? "FeudalKingdom") : "FeudalKingdom";
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg >= 0 ? new Set((process.argv[onlyArg + 1] ?? "").split(",").map(Number)) : null;
const withSheets = process.argv.includes("--sheet");

type Img = { data: Float32Array; width: number; height: number };

async function load(file: string, rotate: boolean): Promise<{ img: Img; png: Buffer }> {
  const png = await (rotate ? sharp(file).rotate(180) : sharp(file)).png().toBuffer();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { img: { data: Float32Array.from(data), width: info.width, height: info.height }, png };
}

/** Taille d'une icône de production sur l'image (px), et du cœur comparé (sans le fond autour). */
const ICON = 44;
const CORE = 28;

/** Icône de référence par ressource : [image, tournée, centre x, centre y]. */
const REFS: Record<string, [string, boolean, number, number]> = {
  coin: ["FeudalKingdom/FK_Page_024.webp", false, 44, 104], // Treehouses
  wood: ["FeudalKingdom/FK_Page_024.webp", false, 100, 104],
  stone: ["FeudalKingdom/FK_Page_012.webp", false, 47, 104], // Shallow Mine
  metal: ["FeudalKingdom/FK_Page_012.webp", false, 103, 103],
  sword: ["FeudalKingdom/FK_Page_020.webp", false, 43, 101], // Castle
  tradeGood: ["FeudalKingdom/FK_Page_063.webp", false, 44, 104], // Entrepreneur
};

type Patch = { v: Float32Array; norm: number };

/** Cœur d'icône centré en (cx, cy), centré (moyenne retirée) pour la corrélation. */
function patch(img: Img, cx: number, cy: number): Patch | null {
  const x0 = Math.round(cx - CORE / 2);
  const y0 = Math.round(cy - CORE / 2);
  if (x0 < 0 || y0 < 0 || x0 + CORE > img.width || y0 + CORE > img.height) return null;
  const v = new Float32Array(CORE * CORE * 3);
  let sum = 0;
  for (let y = 0; y < CORE; y++)
    for (let x = 0; x < CORE; x++)
      for (let c = 0; c < 3; c++) {
        const val = img.data[((y0 + y) * img.width + x0 + x) * 3 + c] ?? 0;
        v[(y * CORE + x) * 3 + c] = val;
        sum += val;
      }
  const mean = sum / v.length;
  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    v[i] = (v[i] ?? 0) - mean;
    norm += (v[i] ?? 0) ** 2;
  }
  return { v, norm: Math.sqrt(norm) };
}

function ncc(a: Patch, b: Patch): number {
  let s = 0;
  for (let i = 0; i < a.v.length; i++) s += (a.v[i] ?? 0) * (b.v[i] ?? 0);
  return a.norm && b.norm ? s / (a.norm * b.norm) : 0;
}

const refs: Record<string, Patch> = {};
for (const [r, [file, rot, x, y]] of Object.entries(REFS)) {
  const { img } = await load(path.join("data/images", file), rot);
  const p = patch(img, x, y);
  if (p) refs[r] = p;
}

type Hit = { r: string; x: number; y: number; score: number };

/**
 * Position imprimée habituelle : première icône centrée en (44, 104), 56 px d'une icône à l'autre, 84 px après un « / »,
 * 53 px d'une rangée à l'autre quand les icônes sont en grille.
 */
const FIRST = { x: 44, y: 104 };
const STEP = 56;
const STEP_OR = 84;
const ROW = 53;

/**
 * Icônes dans l'ordre de la fiche : chacune est cherchée près de sa place habituelle (après la précédente) ; la
 * corrélation corrige la place si elle est assez nette, sinon la place habituelle est gardée (score 0).
 */
function locate(img: Img, options: string[][]): Hit[] {
  const out: Hit[] = [];
  /** Meilleure place de l'icône `r` autour de (gx, gy). */
  const around = (r: string, gx: number, gy: number): Hit => {
    const ref = refs[r];
    let best: Hit = { r, x: gx, y: gy, score: 0 };
    for (let dy = -10; dy <= 10; dy++)
      for (let dx = -14; dx <= 14; dx++) {
        // Jamais sur une icône déjà trouvée.
        if (out.some((h) => Math.abs(h.x - gx - dx) < ICON * 0.7 && Math.abs(h.y - gy - dy) < ICON * 0.7)) continue;
        const p = ref ? patch(img, gx + dx, gy + dy) : null;
        const sc = p && ref ? ncc(ref, p) : 0;
        if (sc > Math.max(0.3, best.score)) best = { r, x: gx + dx, y: gy + dy, score: sc };
      }
    return best;
  };
  let rowX = FIRST.x;
  options.forEach((icons, oi) => {
    icons.forEach((r, ii) => {
      const prev = out.at(-1);
      if (!prev) {
        out.push(around(r, FIRST.x, FIRST.y));
        rowX = out[0]?.x ?? FIRST.x;
        return;
      }
      // À droite de la précédente, ou au début de la rangée suivante (grilles de 2 : Manor, Wood Industry…).
      const right = around(r, prev.x + (oi > 0 && ii === 0 ? STEP_OR : STEP), prev.y);
      const below = around(r, rowX, prev.y + ROW);
      out.push(below.score > right.score + 0.05 ? below : right);
    });
  });
  return out;
}

/**
 * Grilles (Wood Industry, Manor, Jewel…) : les meilleures places de chaque ressource dans la zone de production, lues
 * rangée par rangée puis de gauche à droite ; gardées seulement si la suite des ressources est celle de la fiche et que
 * chaque icône est nette.
 */
function grid(img: Img, expected: string[]): Hit[] | null {
  if (expected.length < 3) return null;
  const need: Record<string, number> = {};
  for (const r of expected) need[r] = (need[r] ?? 0) + 1;
  const all: Hit[] = [];
  for (const r of Object.keys(need)) {
    const ref = refs[r];
    if (!ref) return null;
    for (let y = FIRST.y - 12; y <= FIRST.y + 2 * ROW + 12; y += 2)
      for (let x = FIRST.x - 14; x <= FIRST.x + 5 * STEP + 14; x += 2) {
        const p = patch(img, x, y);
        const score = p ? ncc(ref, p) : 0;
        if (score > 0.5) all.push({ r, x, y, score });
      }
  }
  all.sort((a, b) => b.score - a.score);
  const kept: Hit[] = [];
  for (const h of all) {
    if ((need[h.r] ?? 0) === 0) continue;
    if (kept.some((k) => Math.abs(k.x - h.x) < ICON * 0.7 && Math.abs(k.y - h.y) < ICON * 0.7)) continue;
    kept.push(h);
    need[h.r] = (need[h.r] ?? 0) - 1;
  }
  if (kept.length !== expected.length) return null;
  const rows: Hit[][] = [];
  for (const h of [...kept].sort((a, b) => a.y - b.y)) {
    const row = rows.find((rw) => Math.abs((rw[0]?.y ?? 0) - h.y) < ICON / 2);
    if (row) row.push(h);
    else rows.push([h]);
  }
  const ordered = rows.flatMap((rw) => rw.sort((a, b) => a.x - b.x));
  return ordered.every((h, i) => h.r === expected[i]) ? ordered : null;
}

const dir = path.join("data/cards", expansion);
const outFile = `data/productionIcons/${expansion}.json`;
const previous = only ? (JSON.parse(await readFile(outFile, "utf8").catch(() => "{}")) as Record<string, number[][]>) : {};
const result: Record<string, number[][]> = Object.fromEntries(Object.entries(previous).filter(([k]) => !only?.has(Number(k.split("/")[0]))));
const sheets: { name: string; png: Buffer; hits: Hit[] }[] = [];
const missed: string[] = [];
for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json")).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))) {
  const t = JSON.parse(await readFile(path.join(dir, f), "utf8")) as CardTemplate;
  if (only && !only.has(t.serial)) continue;
  for (const side of ["front", "back"] as const) {
    const src = t.images[side];
    if (!src) continue;
    for (const [stageId, rotate] of [[t.orientationToStage[`${side}-0`], false], [t.orientationToStage[`${side}-180`], true]] as const) {
      if (stageId === null) continue;
      const stage = t.stages[String(stageId) as "1"];
      if (!stage?.production.length) continue;
      const { img, png } = await load(path.join("data/images", src), rotate);
      // Détection d'ensemble lue rangée par rangée si elle colle à la fiche (grilles), sinon icône par icône.
      const chosen = grid(img, stage.production.flatMap((g) => g.options.flat())) ?? stage.production.flatMap((g) => locate(img, g.options));
      const key = `${t.serial}/${stageId}`;
      if (withSheets) sheets.push({ name: `${t.serial}-${stageId}`, png, hits: chosen });
      // Icônes restées à leur place habituelle : à vérifier sur les planches.
      if (chosen.some((h) => h.score < 0.5)) missed.push(`${key} ${stage.name} (${chosen.map((h) => h.score.toFixed(2)).join(" ")})`);
      const r3 = (v: number) => Math.round(v * 1000) / 1000;
      result[key] = chosen.map((h) => [r3((h.x - ICON / 2) / img.width), r3((h.y - ICON / 2) / img.height), r3(ICON / img.width), r3(ICON / img.height)]);
    }
  }
}
const keys = Object.keys(result).sort((a, b) => {
  const [x, y] = [a.split("/"), b.split("/")];
  return Number(x[0]) - Number(y[0]) || Number(x[1]) - Number(y[1]);
});
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(result[k])}`).join(",\n")}\n}\n`);
console.log(`${keys.length} étapes localisées${missed.length ? ` ; à vérifier :\n${missed.join("\n")}` : ""}`);

if (sheets.length) {
  const outDir = "data/raw/sheets/production";
  await mkdir(outDir, { recursive: true });
  for (const sh of sheets) {
    const rects = sh.hits
      .map((h, i) => `<rect x="${h.x - ICON / 2}" y="${h.y - ICON / 2}" width="${ICON}" height="${ICON}" fill="none" stroke="red" stroke-width="1.5"/><text x="${h.x - ICON / 2 + 1}" y="${h.y - ICON / 2 + 9}" font-size="9" fill="red">${i + 1} ${h.score.toFixed(2)}</text>`)
      .join("");
    const svg = Buffer.from(`<svg width="373" height="520" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`);
    await sharp(sh.png).composite([{ input: svg }]).png().toFile(path.join(outDir, `${sh.name}.png`));
  }
}
