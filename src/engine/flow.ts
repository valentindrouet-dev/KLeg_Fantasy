import { cardId, type Side } from "../data/schema";
import { expansionEnd, expansionRoundStart, inExpansion } from "./campaign";
import { askOption, nextQuestion } from "./choice";
import { effectKey } from "./effects/registry";
import { isEffectExhausted } from "./exhausted";
import { extraAdvance, landsStayInPlay } from "./passives";
import { shuffle } from "./rng";
import { computeScore } from "./score";
import {
  activeStage,
  cardName,
  clearResources,
  destroy,
  discard,
  hasKeyword,
  instance,
  log,
  moveTo,
  template,
  zoneOf,
  totalResources,
} from "./state";
import type { Answer, Catalog, ChoiceRequest, Draft, FlowStep, GameState, InstanceId, TriggerCtx, TriggerTiming } from "./types";

// Déroulement d'une partie (spec 4.3 et 4.4) : tours, manches, découvertes, effets déclenchés.
// Les étapes passent par une file (`queue`) pour pouvoir s'interrompre sur une décision du joueur.

const CARDS_PER_TURN = 4;
const CARDS_PER_ADVANCE = 2;
const CARDS_PER_DISCOVERY = 2;

/** Complète un état enregistré par une version antérieure (champs ajoutés depuis). */
export function normalizeState(s: Draft["s"]): void {
  s.zones.blocked ??= [];
  s.zones.purged ??= [];
  s.blocks ??= {};
  s.keepInPlay ??= [];
  // Avant les grandes extensions, toutes les cartes découvertes venaient de la boîte de base.
  s.discoveredIds ??= s.discoveries.map((n) => cardId(s.config.expansion, n));
}

/** Extension des cartes citées par numéro dans l'effet en cours : celle de sa carte, sinon la boîte de base. */
export const sourceExpansion = (d: Draft): string => d.expansion ?? d.s.config.expansion;

/** Note une découverte (numéro et instance). */
export function recordDiscovery(s: GameState, id: InstanceId): void {
  const ids = (s.discoveredIds ??= s.discoveries.map((n) => cardId(s.config.expansion, n)));
  s.discoveries.push(instance(s, id).serial);
  ids.push(id);
}

/**
 * Question en attente reformulée avec le texte actuel (au chargement d'une partie) : le libellé est enregistré dans
 * l'état quand la question est posée, une mise à jour qui le précise ne s'appliquait donc qu'aux questions suivantes.
 * Seul le libellé change, et seulement si la question recalculée est bien la même (type et cartes ou options).
 */
export function refreshPendingPrompt(catalog: Catalog, s: GameState): GameState {
  const p = s.pending;
  if (p?.kind !== "choice") return s;
  const d: Draft = { catalog, s: structuredClone(s) };
  let req: ChoiceRequest | null = null;
  try {
    if (p.mode === "effect") {
      req = catalog.effects.get(p.script)?.ask?.(d, p.source, [...p.answers]) ?? null;
    } else {
      const t = catalog.triggers.get(p.script);
      const first = p.answers[0];
      const confirm = Boolean(t?.optional) && (!t?.direct || (first !== undefined && "option" in first));
      if (t && !(confirm && p.answers.length === 0)) req = t.ask?.(d, p.source, confirm ? p.answers.slice(1) : [...p.answers], p.ctx) ?? null;
    }
  } catch {
    return s;
  }
  if (!req || req.type !== p.request.type || req.prompt === p.request.prompt) return s;
  const same = (a: ChoiceRequest, b: ChoiceRequest): boolean => {
    const { prompt: _a, ...ra } = a;
    const { prompt: _b, ...rb } = b;
    void _a;
    void _b;
    return JSON.stringify(ra) === JSON.stringify(rb);
  };
  if (!same(req, p.request)) return s;
  return { ...s, pending: { ...p, request: { ...p.request, prompt: req.prompt } } };
}

/** Exécute les étapes en attente tant qu'aucune décision n'est requise. */
export function runQueue(d: Draft): void {
  while (!d.s.pending && d.s.phase === "playing") {
    const step = d.s.queue.shift();
    if (!step) return;
    runStep(d, step);
  }
}

/** Ajoute des étapes en tête de file, dans l'ordre donné. */
export function pushFront(d: Draft, ...steps: FlowStep[]): void {
  d.s.queue.unshift(...steps);
}

function runStep(d: Draft, step: FlowStep): void {
  switch (step.kind) {
    case "roundDiscovery":
      return roundDiscovery(d);
    case "discover":
      return discover(d, step.card, step.seen ?? false, step.chooseSide ?? false);
    case "shuffle":
      return shuffleDeck(d);
    case "startTurn":
      return startTurn(d);
    case "trigger":
      return startTrigger(d, step.card, step.script, step.ctx);
    case "endTurn":
      return runEndTurn(d);
    case "cleanupTurn":
      return cleanupTurn(d);
    case "endRound":
      return endRound(d);
    case "nextRound":
      return nextRound(d);
    case "reviewDiscoveries":
      return reviewDiscoveries(d, step.since);
    case "expansionEnd":
      return expansionEnd(d);
  }
}

// --- Effets déclenchés ---

/** Déclencheurs d'une carte pour ce moment (effets non rayés du stage actif). */
export function triggersOf(d: Draft, card: InstanceId, timing: TriggerTiming): string[] {
  const stage = activeStage(d.catalog, d.s, card);
  if (!stage) return [];
  const c = instance(d.s, card);
  return stage.effects
    .filter((e) => !isEffectExhausted(d.catalog, d.s, card, stage.id, e))
    .map((e) => effectKey(c.templateId, stage.id, e.id))
    .filter((key) => {
      const t = d.catalog.triggers.get(key)?.timing;
      return typeof t === "string" ? t === timing : (t?.includes(timing) ?? false);
    });
}

/** Met en tête de file les déclencheurs de ces cartes pour ce moment, dans l'ordre des cartes. */
export function queueTriggers(d: Draft, timing: TriggerTiming, cards: readonly InstanceId[], ctx: (card: InstanceId) => TriggerCtx = () => ({})): void {
  const steps = cards.flatMap((card) => triggersOf(d, card, timing).map((script): FlowStep => ({ kind: "trigger", card, script, ctx: ctx(card) })));
  pushFront(d, ...steps);
}

/** Texte imprimé d'un effet à partir de sa clé (`template/stage/effet`). */
export function effectText(d: Draft, script: string): string {
  const [templateId, stage, effect] = script.split("/");
  const t = d.catalog.templates.get(templateId ?? "");
  return t?.stages[(stage ?? "") as "1"]?.effects.find((e) => e.id === effect)?.text ?? script;
}

function startTrigger(d: Draft, card: InstanceId, script: string, ctx: TriggerCtx): void {
  const t = d.catalog.triggers.get(script);
  if (!t) return;
  if (t.when && !t.when(d, card, ctx)) return;
  if (t.optional && !t.direct) {
    d.s.pending = { kind: "choice", source: card, script, mode: "trigger", effect: "", answers: [], request: askOption(t.prompt ?? effectText(d, script), ["Oui", "Non"]), cancellable: false, ctx };
    return;
  }
  continueTrigger(d, card, script, [], ctx);
}

/** Pose la question suivante d'un déclencheur, ou l'applique quand tout est choisi. */
export function continueTrigger(d: Draft, card: InstanceId, script: string, answers: Answer[], ctx: TriggerCtx): void {
  const t = d.catalog.triggers.get(script);
  if (!t) return;
  let own = [...answers];
  // Effet direct : pas de Oui/Non, sauf dans une partie enregistrée avant (sa première réponse est une option).
  const confirm = t.optional && (!t.direct || (answers[0] !== undefined && "option" in answers[0]));
  if (confirm) {
    const first = answers[0];
    if (!first) return startTrigger(d, card, script, ctx);
    if ("option" in first && first.option !== 0) {
      log(d.s, `${cardName(d.catalog, d.s, card)} : effet non utilisé`);
      t.decline?.(d, card, ctx);
      return;
    }
    own = answers.slice(1);
  }
  const fixed = confirm ? answers.slice(0, 1) : [];
  const request = t.ask ? nextQuestion((a) => t.ask?.(d, card, a, ctx) ?? null, own) : null;
  answers = [...fixed, ...own];
  if (request) {
    d.s.pending = { kind: "choice", source: card, script, mode: "trigger", effect: "", answers, request, cancellable: false, ctx };
    return;
  }
  const first = own[0];
  if (t.optional && t.direct && !confirm && first && "cards" in first && first.cards.length === 0) {
    log(d.s, `${cardName(d.catalog, d.s, card)} : effet non utilisé`);
    t.decline?.(d, card, ctx);
    return;
  }
  log(d.s, `${cardName(d.catalog, d.s, card)} : ${effectText(d, script)}`);
  t.run(d, card, own, ctx);
}

// --- Jouer des cartes ---

/**
 * Des cartes entrent en jeu ensemble (début de tour, Avancer, jouée depuis la défausse) : toutes sont en jeu
 * avant que les effets se résolvent (spec 4.6). D'abord les cartes déjà en jeu qui surveillent les arrivées
 * (Volcanic Eruption, Assassin), puis les « when played » des cartes arrivées.
 */
export function playCards(d: Draft, ids: readonly InstanceId[]): void {
  if (ids.length === 0) return;
  // Cartes qui surveillent les arrivées : en jeu, et permanentes (mini-extensions : Uprising, Espionage).
  const watchers = [...d.s.zones.play.filter((id) => !ids.includes(id)), ...d.s.zones.permanent];
  for (const id of ids) {
    if (d.s.zones.deck.includes(id)) d.s.revealCount += 1;
    moveTo(d.s, id, "play");
    const c = instance(d.s, id);
    c.plays = (c.plays ?? 0) + 1;
  }
  queueTriggers(d, "played", ids, () => ({ cards: [...ids] }));
  queueTriggers(d, "otherPlayed", watchers, () => ({ cards: [...ids] }));
}

function startTurn(d: Draft): void {
  d.s.turn += 1;
  log(d.s, `Tour ${d.s.turn} de la manche ${d.s.round}`);
  playFromDeck(d, CARDS_PER_TURN);
}

/** Joue les n cartes du dessus du deck (toutes s'il en reste moins). */
export function playFromDeck(d: Draft, n: number): void {
  const drawn = d.s.zones.deck.slice(0, n);
  // Les ressources gagnées restent jusqu'à la fin du tour, même quand de nouvelles cartes arrivent
  // (décision du 2026-10-02, docs/RULES_DECISIONS.md).
  if (drawn.length) {
    log(d.s, `Cartes jouées : ${drawn.map((id) => cardName(d.catalog, d.s, id)).join(", ")}`);
  }
  playCards(d, drawn);
}

export function advance(d: Draft): void {
  log(d.s, "Avancer");
  playFromDeck(d, CARDS_PER_ADVANCE + extraAdvance(d.catalog, d.s));
}

/** Joue une carte qui n'est pas prise du deck (ex. depuis la défausse) : ses « when played » s'appliquent. */
export function playCard(d: Draft, id: InstanceId): void {
  playCards(d, [id]);
}

/** Défausse les n cartes du dessus du deck (toutes s'il en reste moins). */
export function discardFromDeck(d: Draft, n: number): void {
  for (const id of d.s.zones.deck.slice(0, n)) {
    d.s.revealCount += 1;
    discard(d, id);
    log(d.s, `${cardName(d.catalog, d.s, id)} est défaussée du deck`);
  }
}

// --- Fin de tour ---

/** Fin de tour : effets « End of Turn » des cartes en jeu, puis défausse (spec 4.4). */
export function endTurn(d: Draft): void {
  pushFront(d, { kind: "endTurn" });
}

function runEndTurn(d: Draft): void {
  pushFront(d, { kind: "cleanupTurn" });
  queueTriggers(d, "endTurn", [...d.s.zones.play, ...d.s.zones.permanent]);
}

/** Une carte reste-t-elle en jeu à la fin du tour ? (texte, sticker 7, effet « make … stay in play ») */
export function staysInPlay(d: Draft, id: InstanceId): boolean {
  if ((d.s.keepInPlay ?? []).includes(id) || isStayInPlayCard(d, id)) return true;
  return landsStayInPlay(d.catalog, d.s) && hasKeyword(d.catalog, d.s, id, "Land");
}

/**
 * Carte « Stays in play » par elle-même (texte, sticker 7) : c'est elle qui va sur la ligne du haut, en demi-carte.
 * Une carte gardée un tour par une autre (Shrine, Temple…) ou par une règle (Border Dispute) reste une carte ordinaire.
 */
export function isStayInPlayCard(d: Draft, id: InstanceId): boolean {
  const stage = activeStage(d.catalog, d.s, id);
  if (!stage) return false;
  if (stage.staysInPlay) return true;
  return instance(d.s, id).stickers.some((st) => st.stage === stage.id && st.staysInPlay);
}

/** Défausse une carte en jeu avec les cartes qu'elle bloque (fin de tour, fin de manche). */
function discardWithBlocked(d: Draft, id: InstanceId): InstanceId[] {
  const blocks = d.s.blocks ?? {};
  const held = blocks[id] ?? [];
  delete blocks[id];
  for (const b of held) discard(d, b);
  discard(d, id);
  return held;
}

function cleanupTurn(d: Draft): void {
  for (const id of [...d.s.zones.play]) {
    if (!staysInPlay(d, id)) discardWithBlocked(d, id);
  }
  d.s.keepInPlay = [];
  delete d.s.loseNext;
  const lost = totalResources(d.s.resources);
  clearResources(d.s);
  log(d.s, lost ? `Fin du tour (${lost} ressource(s) perdue(s))` : "Fin du tour");
  pushFront(d, d.s.zones.deck.length === 0 ? { kind: "endRound" } : { kind: "startTurn" });
}

// --- Manches ---

/** Fin de manche : tout est défaussé, puis les effets « End of Round » des cartes qui étaient en jeu. */
function endRound(d: Draft): void {
  const wasInPlay = [...d.s.zones.play];
  const held: Record<InstanceId, InstanceId[]> = {};
  for (const id of wasInPlay) held[id] = discardWithBlocked(d, id);
  log(d.s, `Fin de la manche ${d.s.round}`);
  pushFront(d, ...(inExpansion(d.s) ? [{ kind: "expansionEnd" } as const] : []), { kind: "nextRound" });
  queueTriggers(d, "endRound", [...wasInPlay, ...d.s.zones.permanent], (card) => ({ cards: held[card] ?? [] }));
}

function nextRound(d: Draft): void {
  // Mini-extension : 4 manches sans découverte de 2 cartes ; elle se termine quand sa carte est détruite.
  if (inExpansion(d.s)) {
    if (expansionRoundStart(d)) return;
    d.s.round += 1;
    d.s.turn = 0;
    log(d.s, `Manche ${d.s.round} (${d.s.campaign?.grand ?? "mini-extension"}, manche ${d.s.campaign?.rounds ?? 0}/4)`);
    pushFront(d, { kind: "shuffle" }, { kind: "startTurn" });
    queueTriggers(d, "betweenRounds", [...d.s.zones.permanent]);
    return;
  }
  if (d.s.finalRound) {
    d.s.phase = "gameOver";
    d.s.queue = [];
    const score = computeScore(d.catalog, d.s);
    log(d.s, `Fin de la partie : ${score.total} gloire`);
    return;
  }
  d.s.round += 1;
  d.s.turn = 0;
  log(d.s, `Manche ${d.s.round}`);
  pushFront(d, { kind: "roundDiscovery" }, { kind: "reviewDiscoveries", since: d.s.discoveries.length }, { kind: "shuffle" }, { kind: "startTurn" });
  queueTriggers(d, "betweenRounds", [...d.s.zones.permanent]);
}

/** Avant le mélange, le joueur voit les cartes découvertes depuis la fin de la manche (hors parchemins). */
function reviewDiscoveries(d: Draft, since: number): void {
  const ids = d.s.discoveredIds;
  const found =
    ids && ids.length === d.s.discoveries.length
      ? [...new Set(ids.slice(since))]
      : Object.values(d.s.cards)
          .filter((c) => d.s.discoveries.slice(since).includes(c.serial) && template(d.catalog, c.templateId).expansion === d.s.config.expansion)
          .map((c) => c.instanceId);
  const cards = found
    .filter((id) => !template(d.catalog, instance(d.s, id).templateId).isParchment)
    .filter((id) => !["box", "destroyed"].includes(zoneOf(d.s, id)));
  if (cards.length) d.s.pending = { kind: "newCards", cards };
}

/** Mélange toutes les cartes du royaume hors permanentes en un nouveau deck, sans changer leur orientation. */
function shuffleDeck(d: Draft): void {
  const cards = [...d.s.zones.deck, ...d.s.zones.discard, ...d.s.zones.play];
  const r = shuffle(cards, d.s.rng);
  d.s.rng = r.state;
  d.s.zones.deck = r.items;
  d.s.zones.discard = [];
  d.s.zones.play = [];
  d.s.revealCount += 1;
  log(d.s, `Mélange : ${r.items.length} cartes dans le deck`);
  // Sticker 17 (Merchants) : « Start each round with this card already in your play area. » Elle n'est pas jouée.
  for (const id of r.items.filter((x) => startsInPlay(d, x))) {
    moveTo(d.s, id, "play");
    log(d.s, `${cardName(d.catalog, d.s, id)} commence la manche en jeu`);
  }
}

/** Sticker 17 sur le stage visible. */
export function startsInPlay(d: Draft, id: InstanceId): boolean {
  const stage = activeStage(d.catalog, d.s, id);
  return stage !== null && instance(d.s, id).stickers.some((st) => st.stage === stage.id && st.startsInPlay);
}

// --- Découvertes (spec 4.4 et 4.6) ---

/**
 * Prochaines cartes de la boîte dans l'ordre des numéros (la carte 0 n'est jamais découverte). Seulement celles de la
 * boîte de base : les cartes d'une grande extension restées dans la boîte sont « derrière » (parchemin Merchants 00).
 */
export function nextInBox(d: Draft, n: number): InstanceId[] {
  return [...d.s.zones.box]
    .filter((id) => instance(d.s, id).serial >= 1 && template(d.catalog, instance(d.s, id).templateId).expansion === d.s.config.expansion)
    .sort((a, b) => instance(d.s, a).serial - instance(d.s, b).serial)
    .slice(0, n);
}

/** Les cartes de la boîte qui portent ces numéros, dans l'extension de l'effet en cours (sourceExpansion). */
export function boxCardsBySerial(d: Draft, serials: readonly number[]): InstanceId[] {
  const expansion = sourceExpansion(d);
  return d.s.zones.box.filter((id) => serials.includes(instance(d.s, id).serial) && template(d.catalog, instance(d.s, id).templateId).expansion === expansion);
}

/** Début de manche : découvrir les 2 cartes suivantes, ou lire le parchemin s'il vient en premier. */
function roundDiscovery(d: Draft): void {
  const [first] = nextInBox(d, 1);
  if (first === undefined) {
    log(d.s, "La boîte est vide : aucune découverte");
    return;
  }
  if (template(d.catalog, instance(d.s, first).templateId).isParchment) {
    revealParchment(d, first);
    return;
  }
  discoverNormally(d, CARDS_PER_DISCOVERY);
}

/** Découvre les n cartes suivantes de la boîte. */
export function discoverNormally(d: Draft, n: number): void {
  pushFront(d, ...nextInBox(d, n).map((card): FlowStep => ({ kind: "discover", card })));
}

/** Découvre ces cartes de la boîte, dans l'ordre (celles qui n'y sont plus sont ignorées). */
export function discoverSerials(d: Draft, serials: readonly number[]): void {
  const ids = serials.flatMap((n) => boxCardsBySerial(d, [n]));
  if (ids.length === 0) log(d.s, `Carte(s) ${serials.join(", ")} déjà découverte(s)`);
  pushFront(d, ...ids.map((card): FlowStep => ({ kind: "discover", card })));
}

function markFinalRound(d: Draft, id: InstanceId): void {
  if (template(d.catalog, instance(d.s, id).templateId).isFinalRoundMarker && !d.s.finalRound) {
    d.s.finalRound = true;
    log(d.s, "C'est la dernière manche");
  }
}

function revealParchment(d: Draft, id: InstanceId): void {
  d.s.revealCount += 1;
  recordDiscovery(d.s, id);
  markFinalRound(d, id);
  log(d.s, `Parchemin découvert : ${cardName(d.catalog, d.s, id)}`);
  d.s.pending = { kind: "parchment", card: id };
}

/** Après lecture : instructions du parchemin, puis destruction. */
export function resolveParchment(d: Draft, id: InstanceId): void {
  d.s.pending = null;
  const t = template(d.catalog, instance(d.s, id).templateId);
  const script = d.catalog.parchments.get(t.id);
  destroy(d, id);
  if (script) script(d, id);
  log(d.s, `Parchemin #${t.serial} détruit`);
}

/** Découvre une carte : elle va dans la défausse (ou dans les permanentes), après le choix de face si besoin. */
export function discover(d: Draft, id: InstanceId, seen = false, chooseSide = false): void {
  if (!d.s.zones.box.includes(id)) return; // déjà sortie de la boîte entre-temps
  d.s.revealCount += 1;
  const t = template(d.catalog, instance(d.s, id).templateId);
  if (t.isParchment) {
    revealParchment(d, id);
    return;
  }
  markFinalRound(d, id);
  // Une carte découverte arrive côté recto ; on ne choisit la face que si une instruction le dit (parchemin 37).
  // Décision du 2026-10-03, docs/RULES_DECISIONS.md.
  if (chooseSide && t.chooseSideOnDiscover) {
    d.s.pending = { kind: "chooseSide", card: id };
    return;
  }
  placeDiscovered(d, id, seen);
}

export function resolveSide(d: Draft, id: InstanceId, side: Side): void {
  d.s.pending = null;
  instance(d.s, id).orientation = { side, rotation: 0 };
  placeDiscovered(d, id, true); // ses deux faces viennent d'être montrées
}

function placeDiscovered(d: Draft, id: InstanceId, seen: boolean): void {
  discard(d, id);
  recordDiscovery(d.s, id);
  log(d.s, `Carte découverte : ${cardName(d.catalog, d.s, id)}`);
  // Carte à flèches rouges : toujours présentée, on y choisit sa face.
  if (!seen || template(d.catalog, instance(d.s, id).templateId).chooseSideOnDiscover) presentDiscovery(d);
}

/**
 * Carte découverte par un effet (Magistrate → Border…) : la fenêtre « Nouvelles cartes » la présente, juste après
 * les autres découvertes du même effet (demande du 2026-10-03). En début de manche, la présentation est déjà prévue.
 */
function presentDiscovery(d: Draft): void {
  const at = d.s.queue.findIndex((step) => step.kind !== "discover");
  if (at >= 0 && d.s.queue[at]?.kind === "reviewDiscoveries") return;
  const step: FlowStep = { kind: "reviewDiscoveries", since: d.s.discoveries.length - 1 };
  if (at < 0) d.s.queue.push(step);
  else d.s.queue.splice(at, 0, step);
}

/**
 * Montre des cartes de la boîte et fait choisir `pick` d'entre elles (« Discover X (84 / 85) »,
 * parchemins 30 et 47). Les autres retournent dans la boîte ou sont détruites.
 */
export function offerDiscovery(
  d: Draft,
  options: InstanceId[],
  pick: number,
  leftovers: "box" | "destroy",
  source: InstanceId | null,
): void {
  const available = options.filter((id) => d.s.zones.box.includes(id));
  if (available.length === 0) {
    log(d.s, "Aucune des cartes à découvrir n'est dans la boîte");
    return;
  }
  d.s.revealCount += 1;
  if (available.length <= pick) {
    pushFront(d, ...available.map((card): FlowStep => ({ kind: "discover", card })));
    return;
  }
  d.s.pending = { kind: "discoverChoice", source, options: available, remaining: pick, picked: [], leftovers };
}

export function resolveDiscoveryChoice(d: Draft, id: InstanceId): void {
  const p = d.s.pending;
  if (p?.kind !== "discoverChoice") throw new Error("Aucun choix de découverte en cours");
  const picked = [...p.picked, id];
  if (p.remaining > 1) {
    d.s.pending = { ...p, remaining: p.remaining - 1, picked };
    return;
  }
  d.s.pending = null;
  for (const other of p.options.filter((o) => !picked.includes(o))) {
    if (p.leftovers === "destroy") {
      destroy(d, other);
      log(d.s, `Carte détruite sans être découverte : #${instance(d.s, other).serial}`);
    }
  }
  pushFront(d, ...picked.map((card): FlowStep => ({ kind: "discover", card, seen: true })));
}
