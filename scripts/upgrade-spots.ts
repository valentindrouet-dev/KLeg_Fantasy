// Position des icônes de coût des améliorations, mesurée sur les images (pour dessiner une croix sur une icône rayée :
// Royal Visit, Bordering Lands…). La boîte d'amélioration est une planche marron ; les icônes y sont les taches qui ne
// sont pas couleur planche, rangées dans l'ordre de lecture (rangées de haut en bas, puis de gauche à droite), qui est
// l'ordre du coût dans les fiches. La flèche blanche est écartée.
// Sortie : data/upgradeIcons/<extension>.json, clé « serial/stage/amélioration », valeur [gauche, haut, largeur, hauteur]
// en fractions de la carte (étape lue à l'endroit), une par icône du coût.
//   npx tsx scripts/upgrade-spots.ts [--only 43,104] [--sheet]   (--sheet : planches dans data/raw/sheets/upgrades)

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { CardTemplate } from "../src/data/schema";

type Rect = { x: number; y: number; w: number; h: number; n: number };
type Raw = { data: Buffer; width: number; height: number };

const expansionArg = process.argv.indexOf("--expansion");
const expansion = expansionArg >= 0 ? (process.argv[expansionArg + 1] ?? "FeudalKingdom") : "FeudalKingdom";
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg >= 0 ? new Set((process.argv[onlyArg + 1] ?? "").split(",").map(Number)) : null;
const withSheets = process.argv.includes("--sheet");

async function load(file: string, rotate: boolean): Promise<{ raw: Raw; png: Buffer }> {
  const png = await (rotate ? sharp(file).rotate(180) : sharp(file)).png().toBuffer();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { raw: { data, width: info.width, height: info.height }, png };
}

function rgb(img: Raw, x: number, y: number): [number, number, number] {
  const i = (y * img.width + x) * 3;
  return [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0];
}

/** Couleur de planche : brun orangé moyen. */
function isBoard([r, g, b]: [number, number, number]): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 70 || max > 215) return false;
  const sat = (max - min) / max;
  if (sat < 0.3 || sat > 0.8 || r !== max) return false;
  const hue = (60 * (g - b)) / (max - min); // r est le max
  return hue >= 15 && hue <= 45;
}





/** Part des pixels « planche » dans un rectangle. */
function boardShare(img: Raw, x0: number, y0: number, w: number, h: number): number {
  let n = 0;
  let b = 0;
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(img.height, y0 + h); y++)
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(img.width, x0 + w); x++) {
      n++;
      if (isBoard(rgb(img, x, y))) b++;
    }
  return n ? b / n : 0;
}

const SIZE = 25;

/** Flèche blanche d'amélioration : plus grande tache blanche, allongée dans le sens de la flèche. */
function findArrow(img: Raw, arrow: "flip" | "rotate"): Rect | null {
  const { width: W, height: H } = img;
  const [x0, y0, x1, y1] = arrow === "flip" ? [Math.round(W * 0.6), 0, W, Math.round(H * 0.2)] : [Math.round(W * 0.5), Math.round(H * 0.25), W, Math.round(H * 0.5)];
  const seen = new Uint8Array(W * H);
  const white = (x: number, y: number) => {
    const c = rgb(img, x, y);
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] > 215 && Math.max(...c) - Math.min(...c) < 45;
  };
  let best: Rect | null = null;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (seen[y * W + x] || !white(x, y)) continue;
      const stack = [[x, y]];
      seen[y * W + x] = 1;
      let [minX, maxX, minY, maxY, n] = [x, x, y, y, 0];
      while (stack.length) {
        const [px, py] = stack.pop() as [number, number];
        n++;
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
        for (const [qx, qy] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]] as const) {
          if (qx < x0 || qx >= x1 || qy < y0 || qy >= y1 || seen[qy * W + qx] || !white(qx, qy)) continue;
          seen[qy * W + qx] = 1;
          stack.push([qx, qy]);
        }
      }
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const long = arrow === "flip" ? w > h * 2 && w >= 25 : h > w * 2 && h >= 25;
      if (long && (!best || n > best.n)) best = { x: minX, y: minY, w, h, n };
    }
  return best;
}

/**
 * Gabarit des boîtes d'amélioration (cartes générées) : icônes de 25 px au pas de 28. « → » : sous la flèche, colonnes
 * centrées vers x = 326 ; « ↓ » : à gauche de la flèche, rangées posées sur la ligne du milieu. Plusieurs dispositions
 * (colonnes, rangées, dernière rangée calée à gauche ou à droite) et décalages sont essayés : on garde celle où les
 * icônes couvrent le moins de planche et où la planche les entoure le plus.
 */
function templateIcons(img: Raw, n: number, arrow: "flip" | "rotate"): Rect[] {
  const arrowRect = findArrow(img, arrow);
  let best: { rects: Rect[]; score: number } | null = null;
  // Disposition imprimée : « → » une colonne jusqu'à 3 icônes, puis deux ; « ↓ » une rangée jusqu'à 3, puis 2 ou 3
  // rangées (6 icônes : 2 × 3 ou 3 × 2 selon la carte).
  const shapes: number[] =
    arrow === "flip" ? [n <= 3 ? 1 : 2] : n <= 3 ? [n] : [2, 3, 4].filter((c) => c < n && Math.ceil(n / c) <= 3 && Math.ceil(n / c) >= 2);
  for (const cols of shapes) {
  const rows = Math.ceil(n / cols);
  for (const align of ["left", "right"] as const) {
    const slots: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const inRow = r === rows - 1 ? n - r * cols : cols;
      slots.push([(i % cols) + (align === "right" ? cols - inRow : 0), r]);
    }
    for (const pitch of [27, 28, 29, 30]) {
      const width = cols * pitch - (pitch - SIZE);
      const height = rows * pitch - (pitch - SIZE);
      // Calage sur la flèche : « → » au-dessus des icônes, centrée ; « ↓ » à droite des icônes, centrée en hauteur.
    const [ax, ay] = arrowRect
      ? arrow === "flip"
        ? [arrowRect.x + arrowRect.w / 2 - width / 2, arrowRect.y + arrowRect.h + 4]
        : [arrowRect.x - 3 - width, arrowRect.y + arrowRect.h / 2 - height / 2]
      : arrow === "flip"
        ? [326 - width / 2, 44]
        : [330 - width, 250 - height];
      const [rx, ry] = arrowRect ? [8, 8] : [16, 16];
      for (let dx = -rx; dx <= rx; dx += 2)
        for (let dy = -ry; dy <= ry; dy += 2) {
          const rects = slots.map(([c, r]): Rect => ({ x: Math.round(ax + dx + c * pitch), y: Math.round(ay + dy + r * pitch), w: SIZE, h: SIZE, n: 0 }));
          // La boîte « ↓ » est au-dessus de la ligne du milieu, à gauche de sa flèche ; la boîte « → » sous la sienne.
          const out =
            arrow === "rotate"
              ? rects.some((r) => r.y + r.h > img.height / 2 - 1)
              : rects.some((r) => r.y < 40 || r.x + r.w > 362);
          if (out) continue;
          const inside = rects.reduce((sum, r) => sum + iconShare(img, r), 0) / n;
          const [bx, by] = [Math.min(...rects.map((r) => r.x)), Math.min(...rects.map((r) => r.y))];
          const ring = (boardShare(img, bx - 5, by - 5, width + 10, 3) + boardShare(img, bx - 5, by + height + 2, width + 10, 3) + boardShare(img, bx - 5, by, 3, height) + boardShare(img, bx + width + 2, by, 3, height)) / 4;
          const score = ring + inside;
          if (!best || score > best.score) best = { rects, score };
        }
    }
  }
  }
  return best?.rects ?? [];
}

/** Ressemblance à une icône : contour sombre sur le bord, et pas de planche au centre. */
function iconShare(img: Raw, r: Rect): number {
  let edge = 0;
  let edgeN = 0;
  for (let k = 0; k < r.w; k++) {
    for (const [x, y] of [[r.x + k, r.y + 1], [r.x + k, r.y + r.h - 2], [r.x + 1, r.y + k], [r.x + r.w - 2, r.y + k]] as const) {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      edgeN++;
      const c = rgb(img, x, y);
      if (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] < 70) edge++;
    }
  }
  const centre = 1 - boardShare(img, r.x + 7, r.y + 7, r.w - 14, r.h - 14);
  return (edgeN ? edge / edgeN : 0) * 0.5 + centre * 0.5;
}

/** Ordre de lecture : rangées (tolérance d'une demi-icône), puis de gauche à droite. */
function readingOrder(rects: Rect[]): Rect[] {
  const rows: Rect[][] = [];
  for (const r of [...rects].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2))) {
    const row = rows.find((rw) => Math.abs(rw[0]!.y + rw[0]!.h / 2 - (r.y + r.h / 2)) <= r.h / 2);
    if (row) row.push(r);
    else rows.push([r]);
  }
  return rows.flatMap((rw) => rw.sort((a, b) => a.x - b.x));
}

const dir = path.join("data/cards", expansion);
const outFile = `data/upgradeIcons/${expansion}.json`;
const previous = only ? (JSON.parse(await readFile(outFile, "utf8").catch(() => "{}")) as Record<string, number[][]>) : {};
const result: Record<string, number[][]> = Object.fromEntries(Object.entries(previous).filter(([k]) => !only?.has(Number(k.split("/")[0]))));
const sheets: { name: string; png: Buffer; rects: Rect[]; board: Rect | null }[] = [];
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
      for (const u of stage?.upgrades ?? []) {
        if (u.cost.length === 0) continue;
        const { raw, png } = await load(path.join("data/images", src), rotate);
        const W = raw.width;
        const H = raw.height;
        // → en haut à droite ; ↓ à droite, contre la ligne du milieu.
        const zone: [number, number, number, number] = u.arrow === "flip" ? [Math.round(W * 0.62), 0, W, Math.round(H * 0.36)] : [Math.round(W * 0.4), Math.round(H * 0.2), W, Math.round(H * 0.5)];
        const board: Rect | null = null;
        void zone;
        const chosen = templateIcons(raw, u.cost.length, u.arrow);
        const key = `${t.serial}/${stageId}/${u.id}`;
        if (withSheets) sheets.push({ name: `${t.serial}-${stageId}-${u.id}`, png, rects: readingOrder(chosen), board });
        if (chosen.length !== u.cost.length) {
          missed.push(`${key} (${chosen.length}/${u.cost.length})`);
          continue;
        }
        result[key] = readingOrder(chosen).map((r) => [r.x / W, r.y / H, r.w / W, r.h / H].map((v) => Math.round(v * 1000) / 1000));
      }
    }
  }
}
const keys = Object.keys(result).sort((a, b) => {
  const [x, y] = [a.split("/"), b.split("/")];
  return Number(x[0]) - Number(y[0]) || Number(x[1]) - Number(y[1]) || (x[2] ?? "").localeCompare(y[2] ?? "");
});
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(result[k])}`).join(",\n")}\n}\n`);
console.log(`${keys.length} coûts localisés${missed.length ? ` ; incomplets : ${missed.join(", ")}` : ""}`);

if (sheets.length) {
  const outDir = "data/raw/sheets/upgrades";
  await mkdir(outDir, { recursive: true });
  for (const sh of sheets) {
    const b = sh.board ? `<rect x="${sh.board.x}" y="${sh.board.y}" width="${sh.board.w}" height="${sh.board.h}" fill="none" stroke="blue" stroke-width="1"/>` : "";
    const rects = sh.rects.map((r, i) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="red" stroke-width="1.5"/><text x="${r.x + 1}" y="${r.y + 8}" font-size="9" fill="red">${i + 1}</text>`).join("");
    const svg = Buffer.from(`<svg width="373" height="520" xmlns="http://www.w3.org/2000/svg">${b}${rects}</svg>`);
    await sharp(sh.png).composite([{ input: svg }]).png().toFile(path.join(outDir, `${sh.name}.png`));
  }
}
