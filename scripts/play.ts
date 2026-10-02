import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readResources } from "./cardFiles";
import { loadCatalog } from "../tests/helpers/catalog";
import {
  act,
  activeStage,
  canUndo,
  cardName,
  computeScore,
  current,
  describeAction,
  formatCounts,
  getLegalActions,
  newSession,
  randomSeed,
  undo,
  type Catalog,
  type GameState,
  type Session,
} from "../src/engine";

// Partie de Kingdom Legacy en ligne de commande (phase P1, avant l'interface).
// npm run play -- [--seed N] [--strict] [--auto]

const args = process.argv.slice(2);
const seedArg = args.indexOf("--seed");
const seed = seedArg >= 0 ? Number(args[seedArg + 1]) : randomSeed();
const strict = args.includes("--strict");
const auto = args.includes("--auto");

const labels = new Map<string, string>([
  ...(await readResources()).map((r): [string, string] => [r.id, r.label_fr]),
  ["rotate", "↓"],
  ["flip", "→"],
  ["fame", "Gloire"],
  ["passive", "passif"],
  ["activated", "activé"],
  ["time", "fin de tour"],
  ["destroy", "détruire"],
  ["triggeredOptional", "déclenché, facultatif"],
  ["triggeredForced", "déclenché, obligatoire"],
  ["oneTime", "une fois"],
]);
const icon = (text: string): string =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => `[${labels.get(k) ?? k}]`).replace(/<[^>]+>/g, "");

function cardLine(catalog: Catalog, s: GameState, id: string): string {
  const st = activeStage(catalog, s, id);
  if (!st) return cardName(catalog, s, id);
  const prod = st.production.map((g) => g.options.map((o) => o.map((r) => `{${r}}`).join("")).join("/")).join(" + ");
  const bits = [
    st.keywords.join(", "),
    st.fame ? `${st.fame} gloire` : "",
    prod ? `produit ${prod}` : "",
    st.staysInPlay ? "reste en jeu" : "",
  ].filter(Boolean);
  return icon(`${cardName(catalog, s, id)} (${bits.join(" · ")})${st.text ? `\n      ${st.text}` : ""}`);
}

function show(catalog: Catalog, session: Session): void {
  const s = current(session);
  const score = computeScore(catalog, s);
  console.log("\n" + "=".repeat(72));
  console.log(
    `Manche ${s.round}${s.finalRound ? " (dernière)" : ""} · Tour ${s.turn} · Gloire ${score.total}` +
      ` · Deck ${s.zones.deck.length} · Défausse ${s.zones.discard.length}`,
  );
  const top = s.zones.deck[0];
  console.log(`Dessus du deck : ${top ? cardName(catalog, s, top) : "(vide)"}`);
  if (s.zones.permanent.length) console.log(`Permanentes : ${s.zones.permanent.map((id) => cardName(catalog, s, id)).join(", ")}`);
  console.log("En jeu :");
  for (const id of s.zones.play) console.log(`  - ${cardLine(catalog, s, id)}`);
  console.log(icon(`Ressources : ${formatCounts(Object.fromEntries(Object.entries(s.resources).filter(([, n]) => n > 0)))}`));
  const lost = Object.values(s.lostResources).reduce((a, b) => a + b, 0);
  if (lost) console.log(icon(`(ressources perdues à la dernière action : ${formatCounts(s.lostResources)})`));
  if (s.pending?.kind === "parchment") {
    const st = activeStage(catalog, s, s.pending.card);
    console.log(`\nPARCHEMIN : ${icon(st?.text ?? "")}`);
  }
  if (s.pending?.kind === "discoverChoice") {
    console.log(`\nDécouverte : choisis ${s.pending.remaining} carte(s) parmi :`);
    for (const id of s.pending.options) console.log(`  - ${cardLine(catalog, s, id)}`);
  }
  if (s.pending?.kind === "chooseSide") {
    const id = s.pending.card;
    const t = catalog.templates.get(s.cards[id]?.templateId ?? "");
    console.log(`\nChoisis la face visible de #${s.cards[id]?.serial} :`);
    for (const [k, label] of [["1", "recto"], ["4", "verso"]] as const) {
      const st = t?.stages[k];
      if (st) console.log(icon(`  - ${label} : ${st.name} — ${st.text}`));
    }
  }
}

function showEnd(catalog: Catalog, s: GameState): void {
  const score = computeScore(catalog, s);
  console.log("\nFIN DE LA PARTIE");
  for (const l of score.lines.filter((x) => x.fame !== 0 || x.variable)) {
    console.log(`  ${l.name} : ${l.fame}${l.variable ? " (+ calcul à faire à la main)" : ""}`);
  }
  console.log(`Score : ${score.total} gloire (graine ${s.config.seed})`);
}

const catalog = await loadCatalog();
let session = newSession(catalog, { expansion: "FeudalKingdom", seed, undoMode: strict ? "strict" : "free" });
console.log(`Kingdom Legacy, Feudal Kingdom. Graine ${seed}, annulation ${strict ? "stricte" : "libre"}.`);

if (auto) {
  let r = seed || 1;
  while (current(session).phase === "playing") {
    const legal = getLegalActions(catalog, current(session));
    r = (r * 1103515245 + 12345) % 2147483648;
    const action = legal[r % legal.length];
    if (!action) break;
    session = act(session, action);
  }
  console.log(`${session.record.actions.length} actions jouées au hasard, ${current(session).round} manches.`);
  showEnd(catalog, current(session));
  process.exit(0);
}

// Lecture ligne à ligne par itérateur : aucune ligne perdue quand l'entrée est redirigée.
const rl = createInterface({ input: stdin });
const lines = rl[Symbol.asyncIterator]();
async function ask(prompt: string): Promise<string | null> {
  stdout.write(prompt);
  const next = await lines.next();
  return next.done ? null : next.value;
}

for (;;) {
  const s = current(session);
  if (s.phase === "gameOver") {
    showEnd(catalog, s);
    break;
  }
  show(catalog, session);
  const legal = getLegalActions(catalog, s);
  console.log("");
  legal.forEach((a, i) => console.log(icon(`  ${String(i + 1).padStart(2)}. ${describeAction(catalog, s, a)}`)));
  const extra = [canUndo(session) ? "u = annuler" : "", "j = journal", "q = quitter"].filter(Boolean).join(", ");
  const line = await ask(`Ton choix (${extra}) : `);
  if (line === null) break;
  const answer = line.trim().toLowerCase();
  if (answer === "q") break;
  if (answer === "j") {
    for (const e of s.log.slice(-15)) console.log(icon(`  [M${e.round} T${e.turn}] ${e.text}`));
    continue;
  }
  if (answer === "u") {
    if (canUndo(session)) session = undo(session);
    else console.log("Annulation impossible (mode strict : une information a été révélée).");
    continue;
  }
  const action = legal[Number(answer) - 1];
  if (!action) {
    console.log("Choix invalide.");
    continue;
  }
  session = act(session, action);
}
rl.close();
