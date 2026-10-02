import type { Side } from "../data/schema";
import { shuffle } from "./rng";
import { computeScore } from "./score";
import {
  activeStage,
  cardName,
  clearResources,
  destroy,
  discard,
  instance,
  log,
  moveTo,
  template,
  totalResources,
} from "./state";
import type { Draft, FlowStep, InstanceId } from "./types";

// Déroulement d'une partie (spec 4.3 et 4.4) : tours, manches, découvertes.
// Les étapes passent par une file (`queue`) pour pouvoir s'interrompre sur une décision du joueur.

const CARDS_PER_TURN = 4;
const CARDS_PER_ADVANCE = 2;
const CARDS_PER_DISCOVERY = 2;

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
      return discover(d, step.card);
    case "shuffle":
      return shuffleDeck(d);
    case "startTurn":
      return startTurn(d);
  }
}

// --- Tours ---

function startTurn(d: Draft): void {
  d.s.turn += 1;
  log(d.s, `Tour ${d.s.turn} de la manche ${d.s.round}`);
  playFromDeck(d, CARDS_PER_TURN);
}

/** Joue les n cartes du dessus du deck (toutes s'il en reste moins). */
export function playFromDeck(d: Draft, n: number): void {
  const drawn = d.s.zones.deck.slice(0, n);
  for (const id of drawn) {
    moveTo(d.s, id, "play");
    d.s.revealCount += 1;
  }
  if (drawn.length) {
    clearResources(d.s);
    log(d.s, `Cartes jouées : ${drawn.map((id) => cardName(d.catalog, d.s, id)).join(", ")}`);
  }
  // Les effets « when played » arrivent en P3 : toutes les cartes jouées ensemble sont déjà en jeu ici.
}

export function advance(d: Draft): void {
  log(d.s, "Avancer");
  playFromDeck(d, CARDS_PER_ADVANCE);
}

/** Joue une carte qui n'est pas prise du deck (ex. depuis la défausse) : pas de « when played » en P1. */
export function playCard(d: Draft, id: InstanceId): void {
  moveTo(d.s, id, "play");
  clearResources(d.s);
}

/** Fin de tour : défausse les cartes en jeu sauf « stay in play », puis tour ou manche suivante. */
export function endTurn(d: Draft): void {
  // Effets « End of Turn » : P3.
  for (const id of [...d.s.zones.play]) {
    if (!activeStage(d.catalog, d.s, id)?.staysInPlay) discard(d, id);
  }
  const lost = totalResources(d.s.resources);
  clearResources(d.s);
  log(d.s, lost ? `Fin du tour (${lost} ressource(s) perdue(s))` : "Fin du tour");
  if (d.s.zones.deck.length === 0) endRound(d);
  else pushFront(d, { kind: "startTurn" });
}

// --- Manches ---

function endRound(d: Draft): void {
  for (const id of [...d.s.zones.play]) discard(d, id);
  // Effets « End of Round » des cartes défaussées : P3.
  log(d.s, `Fin de la manche ${d.s.round}`);
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
  pushFront(d, { kind: "roundDiscovery" }, { kind: "shuffle" }, { kind: "startTurn" });
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
}

// --- Découvertes (spec 4.4 et 4.6) ---

/** Prochaines cartes de la boîte dans l'ordre des numéros (la carte 0 n'est jamais découverte). */
export function nextInBox(d: Draft, n: number): InstanceId[] {
  return [...d.s.zones.box]
    .filter((id) => instance(d.s, id).serial >= 1)
    .sort((a, b) => instance(d.s, a).serial - instance(d.s, b).serial)
    .slice(0, n);
}

/** Les cartes de la boîte qui portent ces numéros. */
export function boxCardsBySerial(d: Draft, serials: readonly number[]): InstanceId[] {
  return d.s.zones.box.filter((id) => serials.includes(instance(d.s, id).serial));
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

function markFinalRound(d: Draft, id: InstanceId): void {
  if (template(d.catalog, instance(d.s, id).templateId).isFinalRoundMarker && !d.s.finalRound) {
    d.s.finalRound = true;
    log(d.s, "C'est la dernière manche");
  }
}

function revealParchment(d: Draft, id: InstanceId): void {
  d.s.revealCount += 1;
  d.s.discoveries.push(instance(d.s, id).serial);
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
  else log(d.s, `Instructions du parchemin #${t.serial} non automatisées : à appliquer à la main (phase P3)`);
  log(d.s, `Parchemin #${t.serial} détruit`);
}

/** Découvre une carte : elle va dans la défausse (ou dans les permanentes), après le choix de face si besoin. */
export function discover(d: Draft, id: InstanceId): void {
  if (!d.s.zones.box.includes(id)) return; // déjà sortie de la boîte entre-temps
  d.s.revealCount += 1;
  const t = template(d.catalog, instance(d.s, id).templateId);
  if (t.isParchment) {
    revealParchment(d, id);
    return;
  }
  markFinalRound(d, id);
  if (t.chooseSideOnDiscover) {
    d.s.pending = { kind: "chooseSide", card: id };
    return;
  }
  placeDiscovered(d, id);
}

export function resolveSide(d: Draft, id: InstanceId, side: Side): void {
  d.s.pending = null;
  instance(d.s, id).orientation = { side, rotation: 0 };
  placeDiscovered(d, id);
}

function placeDiscovered(d: Draft, id: InstanceId): void {
  discard(d, id);
  d.s.discoveries.push(instance(d.s, id).serial);
  log(d.s, `Carte découverte : ${cardName(d.catalog, d.s, id)}`);
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
  pushFront(d, ...picked.map((card): FlowStep => ({ kind: "discover", card })));
}
