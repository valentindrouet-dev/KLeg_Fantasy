// Scraper poli de kingdomlegacygame.com (spec section 0 bis).
//
//   npm run scrape                       toutes les cartes de l'extension (0 à 139)
//   npm run scrape -- --only 0,1,23      seulement ces numéros
//   npm run scrape -- --from 10 --to 19  une plage
//   npm run scrape -- --force            ignore le cache HTML et re-télécharge
//   npm run scrape -- --no-images        ne télécharge pas les images
//
// 1 requête/s max, cache local (data/raw/{Expansion}/html), reprise : relancer la commande
// ne re-télécharge que ce qui manque.

import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { RawCardSchema, type RawCard, type RawStage } from "../src/data/rawSchema";
import { ExpansionsFileSchema, StageIdSchema, type StageId } from "../src/data/schema";

const BASE = "https://www.kingdomlegacygame.com";
const USER_AGENT = "KLegFantasy-personal-scraper/0.1 (personal use; 1 req/s)";
const MIN_DELAY_MS = 1100;

type Options = { expansion: string; serials: number[]; force: boolean; images: boolean };

async function parseArgs(argv: string[]): Promise<Options> {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const expansion = value("--expansion") ?? "FeudalKingdom";
  const file = ExpansionsFileSchema.parse(JSON.parse(await readFile("data/expansions.json", "utf8")));
  const def = file.expansions.find((e) => e.id === expansion);
  if (!def) throw new Error(`Extension inconnue dans data/expansions.json : ${expansion}`);
  const only = value("--only");
  const from = Number(value("--from") ?? def.serialFrom);
  const to = Number(value("--to") ?? def.serialTo);
  const serials = only
    ? only.split(",").map(Number)
    : Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (serials.some((n) => !Number.isInteger(n) || n < 0)) throw new Error("Numéros de carte invalides");
  return { expansion, serials, force: argv.includes("--force"), images: !argv.includes("--no-images") };
}

let lastRequestAt = 0;
async function politeFetch(url: string): Promise<Response> {
  const wait = lastRequestAt + MIN_DELAY_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  return res;
}

async function cachedHtml(url: string, file: string, force: boolean): Promise<{ html: string; at: string }> {
  if (force || !existsSync(file)) {
    const html = await (await politeFetch(url)).text();
    await writeFile(file, html, "utf8");
  }
  return { html: await readFile(file, "utf8"), at: (await stat(file)).mtime.toISOString() };
}

function stageIds(hrefs: string[]): StageId[] {
  return hrefs.map((h) => StageIdSchema.parse(Number(h.replace("#stage-", ""))));
}

export function parseCardPage(html: string, expansion: string, serial: number, scrapedAt: string): RawCard {
  const $ = load(html);
  const view = $(".card-view").first();
  // Le site répond 200 même pour une carte inexistante : sans .card-view, ce n'est pas une page de carte.
  if (view.length === 0) throw new Error(`Pas de carte dans la page ${expansion}/${serial}`);
  const front = $(".card-front img.front-img").attr("src") ?? null;
  const back = $(".card-back img.back-img").attr("src") ?? null;
  const hrefs = (side: "front" | "back") =>
    $(`.card-${side} a.click-area`)
      .map((_, a) => $(a).attr("href") ?? "")
      .get();
  const stages: RawStage[] = $(".stages-view .stage")
    .map((_, el): RawStage => {
      const stage = $(el);
      const name = stage.find("h2").first().text().trim();
      const img = stage.find(".stage-image img").attr("src");
      return {
        stage: StageIdSchema.parse(Number(stage.attr("data-stage"))),
        name,
        namePlaceholder: /^Card \d+ Stage \d$/.test(name),
        image: img === back && img !== front ? "back" : "front",
        description: stage.find(".stage-description p.description").attr("data-raw") ?? "",
        flavor: stage.find(".stage-description p.flavor").attr("data-raw") ?? "",
        keywords: stage
          .find(".keywords-list .keyword")
          .map((_, k) => {
            const kw = $(k);
            const id = Number(kw.attr("data-id"));
            const icon = kw.find("img.keyword-icon").attr("src");
            const text = kw.find("p").clone();
            text.find("b").first().remove();
            return {
              id: Number.isInteger(id) ? id : null,
              name: kw.find(".keyword-name").text().trim(),
              icon: icon ? path.basename(icon) : null,
              text: text.text().replace(/\s+/g, " ").trim(),
            };
          })
          .get(),
      };
    })
    .get();
  const header = view.find(".description-with-flavor").first();
  return RawCardSchema.parse({
    expansion,
    serial,
    url: `${BASE}/cards/${expansion}/${serial}`,
    scrapedAt,
    uuid: view.attr("data-uuid") ?? null,
    variant: view.attr("data-variant") ?? null,
    title: view.find(".card-header h1").text().replace(/\s+/g, " ").trim() || null,
    images: { front, back },
    sides: { front: stageIds(hrefs("front")), back: stageIds(hrefs("back")) },
    description: header.find("p.description").attr("data-raw") ?? "",
    flavor: header.find("p.flavor").attr("data-raw") ?? "",
    stages,
  } satisfies RawCard);
}

async function downloadImage(src: string, dir: string, force: boolean): Promise<boolean> {
  const file = path.join(dir, path.basename(src));
  if (!force && existsSync(file)) return false;
  const res = await politeFetch(new URL(src, BASE).toString());
  if (!(res.headers.get("content-type") ?? "").startsWith("image/")) {
    throw new Error(`Réponse non-image pour ${src}`);
  }
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function main(): Promise<void> {
  const opts = await parseArgs(process.argv.slice(2));
  const rawDir = path.join("data/raw", opts.expansion);
  const htmlDir = path.join(rawDir, "html");
  const imgDir = path.join("data/raw/images", opts.expansion);
  await mkdir(htmlDir, { recursive: true });
  await mkdir(imgDir, { recursive: true });

  const failures: string[] = [];
  let downloaded = 0;
  for (const serial of opts.serials) {
    try {
      const url = `${BASE}/cards/${opts.expansion}/${serial}`;
      const { html, at } = await cachedHtml(url, path.join(htmlDir, `${serial}.html`), opts.force);
      const card = parseCardPage(html, opts.expansion, serial, at);
      await writeFile(path.join(rawDir, `${serial}.json`), `${JSON.stringify(card, null, 2)}\n`, "utf8");
      if (opts.images) {
        for (const src of [card.images.front, card.images.back]) {
          if (src && (await downloadImage(src, imgDir, opts.force))) downloaded += 1;
        }
      }
      const names = card.stages.map((s) => (s.namePlaceholder ? `(${s.stage})` : s.name)).join(" | ");
      console.log(`#${serial}  recto[${card.sides.front}] verso[${card.sides.back}]  ${names}`);
    } catch (error) {
      failures.push(`#${serial} : ${error instanceof Error ? error.message : String(error)}`);
      console.error(`#${serial}  ÉCHEC`);
    }
  }
  console.log(`\n${opts.serials.length - failures.length}/${opts.serials.length} cartes, ${downloaded} images téléchargées.`);
  if (failures.length > 0) {
    console.error(`Échecs (relancer la commande pour reprendre) :\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
}

await main();
