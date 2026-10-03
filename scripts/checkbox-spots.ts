// Position des cases à cocher de chaque étape, mesurée sur les images (pour toucher une case précise, y dessiner une
// croix au feutre et entourer la prochaine case d'une piste). Les cases sont des carrés clairs (blancs ou gris pâle)
// bordés de sombre : composantes connexes de pixels clairs, à peu près carrées, de taille voisine, alignées en rangées
// ou en colonnes. On garde le groupe qui a exactement le nombre de cases de la fiche, rangé dans l'ordre de lecture.
// Sortie : data/checkboxes/<extension>.json, clé « serial/stage », valeur une liste [gauche, haut, largeur, hauteur]
// en fractions de la carte (étape lue à l'endroit), dans l'ordre des cases de la fiche.
//   npx tsx scripts/checkbox-spots.ts [--only 25,41] [--sheet]   (--sheet : planches dans data/raw/sheets/boxes)

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { CardTemplate } from "../src/data/schema";

type Rect = { x: number; y: number; w: number; h: number; fill: number };
type Raw = { data: Buffer; width: number; height: number };

const expansion = "FeudalKingdom";
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg >= 0 ? new Set((process.argv[onlyArg + 1] ?? "").split(",").map(Number)) : null;
const withSheets = process.argv.includes("--sheet");
const debug = Boolean(process.env.DEBUG_BOXES);

async function load(file: string, rotate: boolean): Promise<{ raw: Raw; png: Buffer }> {
  const png = await (rotate ? sharp(file).rotate(180) : sharp(file)).png().toBuffer();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { raw: { data, width: info.width, height: info.height }, png };
}

/** Composantes de pixels clairs (fond d'une case) dans une bande de hauteur. */
function lightComponents(img: Raw, y0: number, y1: number, minLight: number): Rect[] {
  const { width: W } = img;
  const mask = new Uint8Array(W * img.height);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = img.data[i] ?? 0;
      const g = img.data[i + 1] ?? 0;
      const b = img.data[i + 2] ?? 0;
      const l = 0.3 * r + 0.59 * g + 0.11 * b;
      if (l >= minLight && Math.max(r, g, b) - Math.min(r, g, b) < 45) mask[y * W + x] = 1;
    }
  }
  const seen = new Uint8Array(W * img.height);
  const out: Rect[] = [];
  const stack: number[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      const start = y * W + x;
      if (!mask[start] || seen[start]) continue;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let n = 0;
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop() ?? 0;
        const px = p % W;
        const py = (p - px) / W;
        n++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        for (const q of [p - 1, p + 1, p - W, p + W]) {
          if (q < 0 || q >= mask.length || seen[q] || !mask[q]) continue;
          if (Math.abs((q % W) - px) > 1) continue;
          seen[q] = 1;
          stack.push(q);
        }
      }
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      if (w >= 9 && h >= 9 && w <= 70 && h <= 70 && w / h > 0.55 && w / h < 1.8) out.push({ x: minX, y: minY, w, h, fill: n / (w * h) });
    }
  }
  return out.filter((r) => r.fill > 0.35);
}

/**
 * Cases d'un quadrillage sombre (pistes Army, Treasury, Quests…) : traits horizontaux (longues suites de pixels
 * sombres), pris deux à deux de haut en bas ; entre deux traits, les traits verticaux par projection. La rangée est
 * coupée en cases égales, calées sur les traits verticaux visibles (un ruban de gloire peut en masquer un).
 */
function gridCells(img: Raw, y0: number, y1: number): Rect[] {
  const { width: W } = img;
  const dark = (x: number, y: number): boolean => {
    const i = (y * W + x) * 3;
    return 0.3 * (img.data[i] ?? 0) + 0.59 * (img.data[i + 1] ?? 0) + 0.11 * (img.data[i + 2] ?? 0) < 80;
  };
  // Traits horizontaux : la plus longue suite sombre de la rangée dépasse 100 px ; rangées voisines fusionnées.
  const rows: { y: number; x0: number; x1: number }[] = [];
  for (let y = y0; y < y1; y++) {
    // Suites sombres d'au moins 15 px (un ruban ou un chiffre peut couper le trait) : étendue et longueur totale.
    let run = 0;
    let total = 0;
    let first = -1;
    let last = -1;
    for (let x = 0; x <= W; x++) {
      if (x < W && dark(x, y)) run++;
      else {
        if (run >= 15) {
          total += run;
          if (first < 0) first = x - run;
          last = x - 1;
        }
        run = 0;
      }
    }
    if (total >= 100 && total >= (last - first) * 0.6) rows.push({ y, x0: first, x1: last });
  }
  const hLines: { y0: number; y1: number; x0: number; x1: number }[] = [];
  for (const r of rows) {
    const last = hLines.at(-1);
    if (last && r.y - last.y1 <= 2) {
      last.y1 = r.y;
      last.x0 = Math.min(last.x0, r.x0);
      last.x1 = Math.max(last.x1, r.x1);
    } else hLines.push({ y0: r.y, y1: r.y, x0: r.x0, x1: r.x1 });
  }
  const cells: Rect[] = [];
  for (let i = 0; i + 1 < hLines.length; i++) {
    const top = hLines[i] as (typeof hLines)[number];
    const bottom = hLines[i + 1] as (typeof hLines)[number];
    const g = bottom.y0 - top.y1;
    if (g < 30 || g > 80) continue;
    const x0 = Math.max(top.x0, bottom.x0);
    const x1 = Math.min(top.x1, bottom.x1);
    // Un quadrillage de cases ne touche pas le bord de la carte (les cadres de fenêtre du décor, si).
    if (x1 - x0 < 60 || x0 < 8 || x1 > W - 8) continue;
    const cols: number[] = [];
    for (let x = x0; x <= x1; x++) {
      let n = 0;
      for (let y = top.y1 + 2; y < bottom.y0 - 1; y++) if (dark(x, y)) n++;
      if (n >= (g - 3) * 0.55) cols.push(x);
    }
    const edges: number[] = [];
    for (const x of [x0, ...cols, x1]) if (!edges.length || x - (edges.at(-1) ?? 0) > 4) edges.push(x);
    let best = { n: 0, score: -Infinity };
    for (let n = 1; n <= 12; n++) {
      const pitch = (x1 - x0) / n;
      if (pitch < g * 0.75 || pitch > g * 1.35) continue;
      const aligned = edges.filter((x) => Math.abs(x0 + Math.round((x - x0) / pitch) * pitch - x) <= 5).length;
      const score = aligned * 10 - Math.abs(pitch - g) / g;
      if (score > best.score) best = { n, score };
    }
    // Il faut que la moitié au moins des séparations attendues soit visible.
    if (best.n === 0 || best.score < ((best.n + 1) / 2) * 10 - 1) continue;
    const pitch = (x1 - x0) / best.n;
    for (let k = 0; k < best.n; k++) cells.push({ x: Math.round(x0 + k * pitch) + 3, y: top.y1 + 2, w: Math.round(pitch) - 5, h: g - 3, fill: 1 });
  }
  return cells;
}

/** Rangées (même hauteur, cases voisines) et colonnes (même abscisse) de cases de taille voisine. */
function lines(rects: Rect[]): Rect[][] {
  const same = (a: Rect, b: Rect) => Math.abs(a.w - b.w) <= Math.max(4, a.w * 0.2) && Math.abs(a.h - b.h) <= Math.max(4, a.h * 0.2);
  const out: Rect[][] = [];
  for (const axis of ["row", "col"] as const) {
    const used = new Set<Rect>();
    const sorted = [...rects].sort((a, b) => (axis === "row" ? a.x - b.x : a.y - b.y));
    for (const r of sorted) {
      if (used.has(r)) continue;
      const line = [r];
      for (const o of sorted) {
        const last = line.at(-1) as Rect;
        if (o === r || used.has(o) || !same(r, o)) continue;
        const aligned = axis === "row" ? Math.abs(o.y - r.y) <= 4 : Math.abs(o.x - r.x) <= 4;
        const gap = axis === "row" ? o.x - (last.x + last.w) : o.y - (last.y + last.h);
        if (aligned && gap >= -2 && gap <= last.w * 1.3) line.push(o);
      }
      if (line.length >= 2) {
        for (const x of line) used.add(x);
        out.push(line);
      }
    }
  }
  return out;
}

/**
 * Une case manque (fusionnée avec un ruban voisin) : une rangée ou colonne régulière de `count - 1` cases est prolongée
 * d'une case, du côté où une tache claire recouvre la place attendue.
 */
function extrapolate(rects: Rect[], count: number): Rect[] | null {
  for (const line of lines(rects)) {
    if (line.length !== count - 1 || line.length < 2) continue;
    const a = line[0] as Rect;
    const b = line[1] as Rect;
    const z = line.at(-1) as Rect;
    const [dx, dy] = [b.x - a.x, b.y - a.y];
    for (const guess of [{ ...a, x: a.x - dx, y: a.y - dy }, { ...z, x: z.x + dx, y: z.y + dy }]) {
      const covered = rects.some((r) => !line.includes(r) && r.x <= guess.x + guess.w * 0.5 && r.x + r.w >= guess.x + guess.w * 0.5 && r.y <= guess.y + guess.h * 0.5 && r.y + r.h >= guess.y + guess.h * 0.5);
      if (covered && guess.x >= 0 && guess.y >= 0) return [...line, guess];
    }
  }
  return null;
}

/**
 * Rangées cachées en partie (Uprising : le décor recouvre la 2e rangée) : une rangée complète est recopiée vers le bas
 * (ou le haut) quand une case de même taille se trouve juste sous (ou sur) sa première case.
 */
function repeatRow(rects: Rect[], count: number): Rect[] | null {
  for (const line of lines(rects)) {
    const first = line[0] as Rect;
    if (count % line.length !== 0 || line.length < 2 || Math.abs((line[1] as Rect).y - first.y) > 4) continue;
    const rows = count / line.length;
    const below = rects.find((r) => !line.includes(r) && Math.abs(r.x - first.x) <= 4 && Math.abs(r.w - first.w) <= 5 && r.y > first.y && r.y - first.y < first.h * 1.8);
    if (!below) continue;
    const dy = below.y - first.y;
    return Array.from({ length: rows }, (_, j) => line.map((r) => ({ ...r, y: r.y + j * dy }))).flat();
  }
  return null;
}

/** Le jeu de rangées (ou colonnes) qui totalise exactement `count` cases de même taille, le plus régulier. */
function pickGroup(rects: Rect[], count: number): Rect[] | null {
  const ls = lines(rects).filter((l) => l.length <= count).slice(0, 60);
  let best: { rects: Rect[]; score: number } | null = null;
  const consider = (chosen: Rect[][]) => {
    const all = chosen.flat();
    if (all.length !== count || new Set(all).size !== count) return;
    const mw = median(all.map((r) => r.w));
    const mh = median(all.map((r) => r.h));
    if (all.some((r) => Math.abs(r.w - mw) > mw * 0.25 || Math.abs(r.h - mh) > mh * 0.25)) return;
    const score = all.reduce((sum, r) => sum + Math.abs(r.w - mw) + Math.abs(r.h - mh), 0) / count - mw * 0.05 - chosen.length * 0.5;
    if (!best || score < best.score) best = { rects: all, score };
  };
  for (let a = 0; a < ls.length; a++) {
    consider([ls[a] as Rect[]]);
    for (let b = a + 1; b < ls.length; b++) {
      consider([ls[a] as Rect[], ls[b] as Rect[]]);
      for (let c = b + 1; c < ls.length; c++) {
        consider([ls[a] as Rect[], ls[b] as Rect[], ls[c] as Rect[]]);
        if (count >= 12) for (let e = c + 1; e < ls.length; e++) consider([ls[a] as Rect[], ls[b] as Rect[], ls[c] as Rect[], ls[e] as Rect[]]);
      }
    }
  }
  return (best as { rects: Rect[] } | null)?.rects ?? null;
}

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

/** Ordre de lecture : rangées de haut en bas (tolérance d'une demi-case), puis de gauche à droite. */
function readingOrder(rects: Rect[]): Rect[] {
  const rows: Rect[][] = [];
  for (const r of [...rects].sort((a, b) => a.y - b.y)) {
    const row = rows.find((rw) => Math.abs((rw[0]?.y ?? 0) - r.y) <= r.h / 2);
    if (row) row.push(r);
    else rows.push([r]);
  }
  return rows.flatMap((rw) => rw.sort((a, b) => a.x - b.x));
}

const dir = path.join("data/cards", expansion);
const outFile = `data/checkboxes/${expansion}.json`;
const previous = only ? (JSON.parse(await readFile(outFile, "utf8").catch(() => "{}")) as Record<string, number[][]>) : {};
const result: Record<string, number[][]> = Object.fromEntries(Object.entries(previous).filter(([k]) => !only?.has(Number(k.split("/")[0]))));
const sheets: { name: string; png: Buffer; rects: Rect[] }[] = [];
const missed: string[] = [];
for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json")).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))) {
  const t = JSON.parse(await readFile(path.join(dir, f), "utf8")) as CardTemplate;
  if (only && !only.has(t.serial)) continue;
  for (const side of ["front", "back"] as const) {
    const src = t.images[side];
    if (!src) continue;
    const up = t.orientationToStage[`${side}-0`];
    const down = t.orientationToStage[`${side}-180`];
    const full = up === null || down === null;
    for (const [stageId, rotate] of [[up, false], [down, true]] as const) {
      if (stageId === null) continue;
      const stage = t.stages[String(stageId) as "1"];
      const count = stage?.checkboxes.length ?? 0;
      if (!stage || count === 0) continue;
      const { raw, png } = await load(path.join("data/images", src), rotate);
      const [y0, y1] = full ? [4, raw.height - 4] : [4, Math.round(raw.height * 0.5)];
      // D'abord les quadrillages sombres (pistes), puis les cases claires, du plus clair au moins clair.
      const grid = gridCells(raw, y0, y1);
      if (debug) console.log(t.serial, stageId, "grille", grid.map((r) => `${r.x},${r.y} ${r.w}x${r.h}`).join(" | "), "lignes", lines(grid).map((l) => l.length));
      let group: Rect[] | null = pickGroup(grid, count);
      for (const light of [215, 195, 175, 155]) {
        if (group) break;
        const comps = lightComponents(raw, y0, y1, light);
        if (debug) console.log(t.serial, stageId, light, comps.map((r) => `${r.x},${r.y} ${r.w}x${r.h} ${r.fill.toFixed(2)}`).join(" | "));
        group = pickGroup(comps, count);
      }
      // Cases trouvées à des seuils différents (une partie de la rangée est plus sombre) : on les réunit.
      const union: Rect[] = [];
      for (const light of [215, 195, 175, 155]) {
        for (const r of lightComponents(raw, y0, y1, light)) {
          // Même case à deux seuils : on garde la plus complète (la plus grande, si elle reste bien remplie).
          const twin = union.findIndex((u) => Math.abs(u.x - r.x) <= 4 && Math.abs(u.y - r.y) <= 4 && Math.abs(u.w - r.w) <= 8);
          const u = union[twin];
          if (!u) union.push(r);
          else if (r.w * r.h > u.w * u.h && r.fill >= 0.5) union[twin] = r;
        }
      }
      group ??= pickGroup(union, count) ?? extrapolate(union, count) ?? repeatRow(union, count);
      const key = `${t.serial}/${stageId}`;
      if (!group) {
        missed.push(`${key} ${stage.name} (${count})`);
        continue;
      }
      const ordered = readingOrder(group);
      result[key] = ordered.map((r) => [r.x / raw.width, r.y / raw.height, r.w / raw.width, r.h / raw.height].map((v) => Math.round(v * 1000) / 1000));
      if (debug) console.log(key, ordered.map((r) => `${r.x},${r.y} ${r.w}x${r.h}`).join(" | "));
      if (withSheets) sheets.push({ name: `${t.serial}-${stageId}`, png, rects: ordered });
    }
  }
}
const keys = Object.keys(result).sort((a, b) => {
  const [x, y] = [a.split("/"), b.split("/")];
  return Number(x[0]) - Number(y[0]) || Number(x[1]) - Number(y[1]);
});
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(result[k])}`).join(",\n")}\n}\n`);
console.log(`${keys.length} étapes localisées${missed.length ? ` ; non trouvées : ${missed.join(", ")}` : ""}`);

if (sheets.length) {
  const outDir = "data/raw/sheets/boxes";
  await mkdir(outDir, { recursive: true });
  for (const sh of sheets) {
    const rects = sh.rects.map((r, i) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="red" stroke-width="2"/><text x="${r.x + 2}" y="${r.y + 10}" font-size="10" fill="red">${i + 1}</text>`).join("");
    const svg = Buffer.from(`<svg width="373" height="520" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`);
    await sharp(sh.png).composite([{ input: svg }]).png().toFile(path.join(outDir, `${sh.name}.png`));
  }
}
