// Position des lignes de texte des effets, mesurée sur les images (pour barrer un effet épuisé ligne par ligne).
// 1. Le texte est noir sur un cadre clair : une ligne de texte est une rangée de pixels où l'on passe très souvent
//    du clair au sombre. Une ligne courte (« Mark 1 ⊗. ») est gardée si elle touche une ligne déjà trouvée.
// 2. Chaque ligne est lue (tesseract) et retrouvée dans le texte imprimé de l'étape : elle appartient à l'effet
//    qui contient ce passage. Les lignes hors effet (« Stays in play. », texte d'ambiance, numéros des cases) sont
//    ignorées.
// Sortie : data/textLines/<extension>.json, clé « serial/stage/effet », valeur une liste de lignes
// [haut, bas, gauche, droite] en fractions de la carte, l'étape lue à l'endroit.
//   npx tsx scripts/text-lines.ts [--only 43,17] [--sheet]   (--sheet : planches de contrôle dans data/raw/sheets/lines)

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import type { CardTemplate, Stage } from "../src/data/schema";

type Line = [number, number, number, number];
type Raw = { data: Buffer; width: number; height: number };

const expansionArg = process.argv.indexOf("--expansion");
const expansion = expansionArg >= 0 ? (process.argv[expansionArg + 1] ?? "FeudalKingdom") : "FeudalKingdom";
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg >= 0 ? new Set((process.argv[onlyArg + 1] ?? "").split(",").map(Number)) : null;
const withSheets = process.argv.includes("--sheet");

const langPath = path.dirname(createRequire(import.meta.url).resolve("@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"));
const worker = await createWorker("eng", 1, { langPath, cachePath: os.tmpdir(), logger: () => {}, errorHandler: () => {} });
await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, user_defined_dpi: "300" });

async function load(file: string, rotate: boolean): Promise<{ raw: Raw; png: Buffer }> {
  const png = await (rotate ? sharp(file).rotate(180) : sharp(file)).png().toBuffer();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { raw: { data, width: info.width, height: info.height }, png };
}

/** Passages du clair (cadre) au sombre (lettre) sur une rangée, avec leurs positions. */
function transitions(img: Raw, y: number, light: number): number[] {
  const out: number[] = [];
  let prev: "L" | "D" | null = null;
  for (let x = Math.round(img.width * 0.04); x < img.width * 0.96; x++) {
    const i = (y * img.width + x) * 3;
    const r = img.data[i] ?? 0;
    const g = img.data[i + 1] ?? 0;
    const b = img.data[i + 2] ?? 0;
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const c = sat < 70 ? (l > light ? "L" : l < 95 ? "D" : null) : null;
    if (c === "D" && prev === "L") out.push(x);
    if (c) prev = c;
  }
  return out;
}

/** Étendue horizontale du texte : là où les passages clair → sombre sont denses (lettres), pas le décor. */
function span(xs: number[], width: number): [number, number] {
  const hist = new Array<number>(width).fill(0);
  for (const x of xs) hist[x] = (hist[x] ?? 0) + 1;
  const W = 14;
  const sums = hist.map((_, x) => hist.slice(x, x + W).reduce((a, b) => a + b, 0));
  const max = Math.max(...sums);
  const dense = sums.map((v, x) => (v >= max * 0.3 ? x : -1)).filter((x) => x >= 0);
  const lo = dense[0] ?? 0;
  const hi = (dense.at(-1) ?? width) + W;
  return [Math.max(0, lo - 3), Math.min(width, hi + 3)];
}

type Band = { top: number; bottom: number; peak: number; xs: number[] };

/** Bandes de rangées « textuelles » entre deux hauteurs (en pixels). */
function bands(img: Raw, from: number, to: number, threshold: number, light: number): Band[] {
  const out: Band[] = [];
  let cur: Band | null = null;
  for (let y = from; y < to; y++) {
    const xs = transitions(img, y, light);
    if (xs.length >= threshold) {
      if (!cur) cur = { top: y, bottom: y, peak: 0, xs: [] };
      cur.bottom = y;
      cur.peak = Math.max(cur.peak, xs.length);
      cur.xs.push(...xs);
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  // Deux bandes très proches sont une seule ligne coupée.
  const merged: Band[] = [];
  for (const b of out) {
    const last = merged.at(-1);
    if (last && b.top - last.bottom <= 3) merged[merged.length - 1] = { top: last.top, bottom: b.bottom, peak: Math.max(last.peak, b.peak), xs: [...last.xs, ...b.xs] };
    else merged.push(b);
  }
  return merged.filter((b) => b.bottom - b.top >= 3 && b.bottom - b.top <= 17);
}

/** Lignes de texte : bandes franches, plus les bandes faibles collées à une ligne déjà trouvée. */
function linesIn(img: Raw, from: number, to: number, loose = false): Line[] {
  const [a, b] = [Math.round(img.height * from), Math.round(img.height * to)];
  const light = loose ? 135 : 165;
  const strong = bands(img, a, b, loose ? 9 : 14, light);
  const weak = bands(img, a, b, 6, light).filter((w) => w.peak >= 8 && !strong.some((s) => s.top <= w.bottom && w.top <= s.bottom));
  const kept = [...strong];
  for (let grew = true; grew; ) {
    grew = false;
    for (const w of weak) {
      if (kept.includes(w)) continue;
      if (kept.some((k) => Math.abs(k.top - w.top) <= 30)) {
        kept.push(w);
        grew = true;
      }
    }
  }
  return kept
    .sort((x, y) => x.top - y.top)
    .map((band): Line => {
      const [x0, x1] = span(band.xs, img.width);
      return [(band.top - 2) / img.height, (band.bottom + 2) / img.height, x0 / img.width, x1 / img.width];
    })
    .filter((l) => lightShare(img, l, light) >= 0.5);
}

/** Part de pixels clairs (hors icônes colorées) sous une ligne : le cadre du texte est clair, une armure ou un feuillage ne l'est pas. */
function lightShare(img: Raw, l: Line, light: number): number {
  let n = 0;
  let lit = 0;
  for (let y = Math.round(l[0] * img.height); y < l[1] * img.height; y++) {
    for (let x = Math.round(l[2] * img.width); x < l[3] * img.width; x++) {
      const i = (y * img.width + x) * 3;
      const r = img.data[i] ?? 0;
      const g = img.data[i + 1] ?? 0;
      const b = img.data[i + 2] ?? 0;
      // Les icônes colorées (pièces, bois) ne comptent pas.
      if (Math.max(r, g, b) - Math.min(r, g, b) >= 70) continue;
      n++;
      if (0.3 * r + 0.59 * g + 0.11 * b > light - 20) lit++;
    }
  }
  return lit / Math.max(n, 1);
}

type Word = { text: string; x0: number; x1: number; confidence: number };

/** Lit une ligne : le texte, et chaque mot avec sa position (fraction de la carte). */
async function read(png: Buffer, l: Line): Promise<{ text: string; words: Word[] }> {
  const top = Math.max(0, Math.round(l[0] * 520) - 3);
  const height = Math.min(520 - top, Math.round((l[1] - l[0]) * 520) + 6);
  const left = Math.max(0, Math.round(l[2] * 373) - 4);
  const width = Math.min(373 - left, Math.round((l[3] - l[2]) * 373) + 8);
  const scale = 4;
  const crop = await sharp(png).extract({ left, top, width, height }).resize({ height: height * scale }).greyscale().normalize().png().toBuffer();
  const { data } = await worker.recognize(crop, {}, { text: true, blocks: true });
  const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((ln) => ln.words)));
  return {
    text: data.text.trim(),
    words: words.map((w) => ({ text: w.text, x0: (left + w.bbox.x0 / scale) / 373, x1: (left + w.bbox.x1 / scale) / 373, confidence: w.confidence })),
  };
}

/**
 * Étendue horizontale d'une ligne : du premier au dernier mot lu qui est un mot du texte imprimé (aux fautes de
 * lecture près). Le bord du cadre et le décor, lus comme du bruit, n'en font pas partie.
 */
function extent(words: Word[], vocabulary: Set<string>): [number, number] | null {
  const vocab = [...vocabulary];
  const known = words.flatMap((w) => {
    const t = w.text.toLowerCase().replace(/[^a-z0-9]/g, "");
    // Un caractère seul (« a », « 1 ») est trop souvent du bruit.
    if (t.length < 2) return [];
    const ok =
      vocabulary.has(t) ||
      (t.length === 3 && vocab.some((v) => v.length === 4 && distance(t, v) === 1)) ||
      (t.length >= 4 && vocab.some((v) => v.length >= 4 && (distance(t, v) <= Math.ceil(v.length / 3) || t.includes(v))));
    if (!ok) return [];
    // Un mot collé à du bruit (« discover«&—% ») a une boîte trop large : on la ramène à sa longueur probable.
    const max = t.length * 0.03;
    return [w.x1 - w.x0 > max ? { x0: w.x0, x1: w.x0 + max } : { x0: w.x0, x1: w.x1 }];
  });
  if (known.length === 0) return null;
  return [Math.min(...known.map((w) => w.x0)) - 0.005, Math.max(...known.map((w) => w.x1)) + 0.005];
}

const STOP = new Set(["the", "and", "you", "your", "for", "this", "that", "with", "from", "then", "any", "its", "are", "all", "card"]);
const words = (s: string): string[] =>
  s
    .replace(/\{\w+\}/g, " ")
    .toLowerCase()
    .split(/[^a-z0-9]+|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/)
    .filter((w) => (w.length >= 3 || /^\d+$/.test(w)) && !STOP.has(w));

/** Distance d'édition (lecture imparfaite : « cain » pour « gain »). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0] ?? 0;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j] ?? 0;
      d[j] = Math.min((d[j] ?? 0) + 1, (d[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length] ?? 0;
}

/** Un mot lu correspond à un mot imprimé, aux fautes de lecture près. */
function same(read: string, printed: string): boolean {
  if (read === printed) return true;
  if (/^\d+$/.test(read) || /^\d+$/.test(printed)) return false;
  if (printed.length >= 4 && read.includes(printed)) return true;
  if (read.length >= 4 && printed.startsWith(read)) return true;
  return printed.length >= 4 && distance(read, printed) <= (printed.length >= 7 ? 2 : 1);
}

/**
 * Retrouve chaque ligne lue dans le texte de l'étape (dans l'ordre) et la rattache à l'effet qui contient ce passage.
 */
function assign(lines: Line[], texts: string[], stage: Stage): Record<string, Line[]> {
  // Mots du texte de l'étape, chacun avec l'effet auquel il appartient (ou null).
  let corpus = stage.text;
  const ranges = stage.effects.map((e) => {
    let at = corpus.indexOf(e.text);
    // Texte d'effet un peu différent de celui de l'étape (ponctuation finale) : retrouvé par son début.
    if (at < 0) at = corpus.indexOf(e.text.slice(0, 40));
    if (at < 0) {
      at = corpus.length + 1;
      corpus = `${corpus} ${e.text}`;
    }
    return { id: e.id, from: at, to: at + e.text.length };
  });
  const tokens: { w: string; effect: string | null }[] = [];
  for (const m of corpus.replace(/\{\w+\}/g, (x) => " ".repeat(x.length)).matchAll(/[A-Za-z0-9]+/g)) {
    const w = m[0].toLowerCase();
    if ((w.length < 3 && !/^\d+$/.test(w)) || STOP.has(w)) continue;
    const pos = m.index ?? 0;
    tokens.push({ w, effect: ranges.find((r) => pos >= r.from && pos < r.to)?.id ?? null });
  }
  // Passage de chaque ligne lue dans le texte : [premier mot, mot suivant le dernier], ou null si illisible.
  const spans: ([number, number] | null)[] = [];
  const matched: number[][] = [];
  let cursor = 0;
  for (const text of texts) {
    const ws = words(text);
    let best = { score: 0, at: -1 };
    for (let i = 0; i < tokens.length && ws.length; i++) {
      const window = tokens.slice(i, i + ws.length + 2).map((t) => t.w);
      const hits = ws.filter((w) => window.some((t) => same(w, t))).length;
      // Égalité : le passage le plus proche après la ligne précédente.
      if (hits > best.score || (hits === best.score && hits > 0 && Math.abs(i - cursor) < Math.abs(best.at - cursor))) best = { score: hits, at: i };
    }
    if (best.at < 0 || (best.score < 2 && best.score / ws.length < 0.5)) {
      spans.push(null);
      matched.push([]);
      continue;
    }
    const hit = tokens.map((_, i) => i).filter((i) => i >= best.at && i < best.at + ws.length + 2 && ws.some((w) => same(w, tokens[i]?.w ?? "")));
    const span: [number, number] = [hit[0] ?? best.at, (hit.at(-1) ?? best.at) + 1];
    spans.push(span);
    matched.push(hit);
    cursor = span[1];
  }
  // Ligne illisible (« Spend ⦿⦿⦿ to », « Mark 1 ⊗. ») entre deux lignes lues : elle porte le texte qui manque entre
  // elles ; s'il est tout entier dans un effet, elle lui appartient.
  const owner = (from: number, to: number): string | null => {
    const part = tokens.slice(from, to);
    if (part.length === 0) return null;
    const first = part[0]?.effect ?? null;
    return part.every((t) => t.effect === first) ? first : null;
  };
  const owners = spans.map((sp, i) => {
    if (sp) {
      // Seuls les mots reconnus comptent (pas ceux qui les séparent dans le texte).
      const part = (matched[i] ?? []).map((j) => tokens[j]).filter((t) => t !== undefined);
      const counts = new Map<string, number>();
      for (const t of part) if (t.effect) counts.set(t.effect, (counts.get(t.effect) ?? 0) + 1);
      const best = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
      // La ligne doit être surtout dans l'effet (pas « Stays in play. » ni le texte d'ambiance).
      return best && best[1] >= part.length / 2 ? best[0] : null;
    }
    const prev = spans.slice(0, i).findLastIndex((x) => x !== null);
    const next = spans.findIndex((x, j) => j > i && x !== null);
    // Une seule ligne illisible dans l'écart (sinon on ne sait pas laquelle porte quoi) ; avant la première ou après
    // la dernière ligne lue, seulement celle qui la touche.
    if (prev >= 0 && next >= 0 ? next - prev !== 2 : prev >= 0 ? i !== prev + 1 : next >= 0 ? i !== next - 1 : true) return null;
    const near = [prev, next].some((j) => j >= 0 && Math.abs((lines[j]?.[0] ?? 9) - (lines[i]?.[0] ?? 0)) < 0.06);
    if (!near) return null;
    const before = prev >= 0 ? spans[prev] : null;
    const after = next >= 0 ? spans[next] : null;
    return owner(before?.[1] ?? 0, after?.[0] ?? tokens.length);
  });
  const out: Record<string, Line[]> = {};
  lines.forEach((line, i) => {
    const o = owners[i];
    if (o) (out[o] ??= []).push(line);
  });
  // Les lignes d'un effet se suivent : une ligne isolée loin des autres (titre, chiffres des cases) est écartée.
  for (const [id, ls] of Object.entries(out)) {
    const groups: Line[][] = [];
    for (const l of ls) {
      const last = groups.at(-1);
      if (last && l[0] - (last.at(-1)?.[0] ?? 0) < 0.065) last.push(l);
      else groups.push([l]);
    }
    out[id] = groups.reduce((a, b) => (b.length > a.length ? b : a), []);
  }
  return out;
}

const dir = path.join("data/cards", expansion);
const outFile = `data/textLines/${expansion}.json`;
const previous = only ? (JSON.parse(await readFile(outFile, "utf8").catch(() => "{}")) as Record<string, Line[]>) : {};
const result: Record<string, Line[]> = Object.fromEntries(Object.entries(previous).filter(([k]) => !only?.has(Number(k.split("/")[0]))));
const sheets: { name: string; png: Buffer; lines: Line[]; owners: (string | null)[] }[] = [];
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
      if (!stage || stage.effects.length === 0) continue;
      const { raw, png } = await load(path.join("data/images", src), rotate);
      const measure = async (loose: boolean) => {
        const lines = full ? linesIn(raw, 0.1, 0.97, loose) : linesIn(raw, 0.14, 0.49, loose);
        const texts: string[] = [];
        const unread = new Set<number>();
        const vocabulary = new Set([stage.text, ...stage.effects.map((e) => e.text)].join(" ").replace(/\{\w+\}/g, " ").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
        const read_: ([number, number] | null)[] = [];
        for (const l of lines) {
          const r = await read(png, l);
          texts.push(r.text);
          read_.push(extent(r.words, vocabulary));
        }
        // Bloc de texte de l'étape : de gauche à droite, les mots reconnus de toutes ses lignes. L'étendue en pixels
        // d'une ligne (icônes et petits mots compris) est ramenée dans ce bloc, le décor autour n'en fait pas partie.
        const known = read_.filter((x) => x !== null);
        const block: [number, number] | null = known.length ? [Math.min(...known.map((x) => x[0])), Math.max(...known.map((x) => x[1]))] : null;
        lines.forEach((l, i) => {
          const x = read_[i];
          if (!x) unread.add(i);
          if (!block) return;
          const pix: [number, number] = [Math.max(l[2], block[0]), Math.min(l[3], block[1])];
          const lo = x ? Math.min(x[0], pix[0]) : pix[0];
          const hi = x ? Math.max(x[1], pix[1]) : pix[1];
          if (hi > lo) lines[i] = [l[0], l[1], Math.max(0, lo), Math.min(1, hi)];
        });
        if (process.env.DEBUG_LINES) console.log(t.serial, stageId, loose, JSON.stringify(texts));
        const owned = assign(lines, texts, stage);
        // Ligne sans mot lu : sa largeur (mesurée sur les pixels, moins sûre) ne dépasse pas celle des autres lignes de l'effet.
        for (const ls of Object.values(owned)) {
          const sure = ls.filter((l) => !unread.has(lines.indexOf(l)));
          if (sure.length === 0) continue;
          const [lo, hi] = [Math.min(...sure.map((l) => l[2])), Math.max(...sure.map((l) => l[3]))];
          ls.forEach((l, k) => {
            if (unread.has(lines.indexOf(l))) ls[k] = [l[0], l[1], Math.max(l[2], lo), Math.min(l[3], hi)];
          });
        }
        return { lines, owned };
      };
      // Cadre gris sur fond sombre, ou ligne très courte : seuils plus bas si un effet n'a rien trouvé.
      let { lines, owned } = await measure(false);
      if (stage.effects.some((e) => !owned[e.id])) {
        const second = await measure(true);
        if (Object.keys(second.owned).length > Object.keys(owned).length) ({ lines, owned } = second);
      }
      for (const [effect, ls] of Object.entries(owned)) {
        result[`${t.serial}/${stageId}/${effect}`] = ls.map((l) => l.map((v) => Math.round(v * 1000) / 1000) as Line);
      }
      if (withSheets) {
        const owners = lines.map((l) => Object.entries(owned).find(([, ls]) => ls.includes(l))?.[0] ?? null);
        sheets.push({ name: `${t.serial}-${stageId}`, png, lines, owners });
      }
    }
  }
  process.stdout.write(`${t.serial} `);
}
await worker.terminate();
const keys = Object.keys(result).sort((a, b) => {
  const [x, y] = [a.split("/"), b.split("/")];
  return Number(x[0]) - Number(y[0]) || Number(x[1]) - Number(y[1]) || (x[2] ?? "").localeCompare(y[2] ?? "");
});
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(result[k])}`).join(",\n")}\n}\n`);
console.log(`\n${keys.length} effets localisés`);

// Planches de contrôle : lignes rattachées à un effet en rouge (avec son nom), ignorées en bleu.
if (sheets.length) {
  const outDir = "data/raw/sheets/lines";
  await mkdir(outDir, { recursive: true });
  for (const sh of sheets) {
    const rects = sh.lines
      .map((l, i) => {
        const color = sh.owners[i] ? "red" : "blue";
        const label = sh.owners[i] ? `<text x="${l[2] * 373 - 2}" y="${l[0] * 520 + 8}" font-size="9" fill="red" text-anchor="end">${sh.owners[i]}</text>` : "";
        return `<rect x="${l[2] * 373}" y="${l[0] * 520}" width="${(l[3] - l[2]) * 373}" height="${(l[1] - l[0]) * 520}" fill="none" stroke="${color}" stroke-width="1.5"/>${label}`;
      })
      .join("");
    const svg = Buffer.from(`<svg width="373" height="520" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`);
    await sharp(sh.png).composite([{ input: svg }]).png().toFile(path.join(outDir, `${sh.name}.png`));
  }
}
