import { cardId, type CardTemplate, type ResourceId } from "../data/schema";
import { askCards, askCardsOrNone, cardsOf } from "./choice";
import { discoveredSerials } from "./exhausted";
import { pushFront, recordDiscovery } from "./flow";
import { canBeDestroyed, destroyCards, friendly, isKind, kingdom, markBox, queueScript, turnCard, unmarkedBoxes } from "./ops";
import { crossOutProduction, productionCount } from "./production";
import { shuffle } from "./rng";
import { cardFame, computeScore } from "./score";
import { activeStage, cardName, hasKeyword, instance, log, lostSeafaring, moveTo, template, zoneOf } from "./state";
import type { Campaign, CardInstance, Catalog, ChoiceRequest, Draft, FlowStep, GameState, InstanceId, TriggerImpl } from "./types";

// Après la partie de base (spec 4.7) : mini-extensions 136, 137, 138. Chacune : purge 12, purge d'une carte
// permanente, puis 4 manches sans découverte de 2 cartes ; la carte d'extension change d'étape à chaque fin de manche.
// Le score de la partie de base et celui après chaque extension forment le chemin de score.

export const EXPANSION_SERIALS = [136, 137, 138] as const;
export const PURGE_SCRIPT = "campaign:purge12";
export const expansionEndScript = (serial: number, stage: number): string => `campaign:end:${serial}/${stage}`;
const PACKET = 12;

/**
 * Grandes extensions jouables (nouvelle boîte de cartes ajoutée au royaume). Chacune : sa purge (paquets de `packet`
 * cartes, puis `permanents` cartes permanentes ; `focus` : « focus 2{wood} »), lancée par son parchemin 00 ; `guide` :
 * la carte qui mène les manches (Merchants 01, puis 10) ; `rounds` manches ; `perRound` : cartes de l'extension
 * découvertes au début de chaque manche (dans l'ordre, jusqu'à la carte `upTo`), sinon aucune ; `scorePath` : sticker
 * du chemin de score ; `cover` : carte dont le dos montre l'extension (Merchants 05) ; `keepAll` : ses cartes restées
 * dans la boîte y restent toutes à la fin (Adventures : la carte des aventures les découvrira plus tard).
 */
export type GrandRules = {
  name: string;
  packet: number;
  permanents: number;
  focus?: { resource: ResourceId; count: number };
  guide?: number;
  rounds: number;
  perRound?: number;
  upTo?: number;
  scorePath: string;
  cover: number;
  keepAll?: boolean;
};
export const GRAND_EXPANSIONS: Record<string, GrandRules> = {
  Merchants: { name: "Merchants", packet: 7, permanents: 2, guide: 1, rounds: 4, scorePath: "13e", cover: 5 },
  RiddingTheWoods: { name: "Ridding the Woods", packet: 8, permanents: 2, focus: { resource: "wood", count: 2 }, rounds: 5, perRound: 5, upTo: 25, scorePath: "13c", cover: 10 },
  FK_Adventures: { name: "Adventures", packet: 10, permanents: 1, rounds: 3, perRound: 2, upTo: 6, scorePath: "13j", cover: 3, keepAll: true },
};
/** Nom affiché d'une grande extension (« Ridding the Woods »). */
export const grandName = (id: string): string => GRAND_EXPANSIONS[id]?.name ?? id;
/** Nombre de manches de l'extension en cours (4 pour les mini-extensions). */
export const expansionRounds = (s: GameState): number => GRAND_EXPANSIONS[s.campaign?.grand ?? ""]?.rounds ?? 4;
export const grandPurgeScript = (expansion: string): string => `campaign:purge:${expansion}`;

export function campaignOf(s: GameState): Campaign {
  s.campaign ??= { base: null, played: [], current: null, rounds: 0, stageAtRoundStart: null };
  return s.campaign;
}

/** Une mini-extension est-elle en cours ? */
export const inExpansion = (s: GameState): boolean => (s.campaign?.current ?? null) !== null;

/** Nom d'une mini-extension (sans « (expansion) »). */
export function expansionName(d: Pick<Draft, "catalog" | "s">, card: InstanceId): string {
  const t = template(d.catalog, instance(d.s, card).templateId);
  return (t.stages["1"]?.name ?? `#${t.serial}`).replace(/ \(expansion\)$/, "");
}

/** Carte d'une mini-extension (136, 137, 138 de la boîte de base). */
const isMiniCard = (s: GameState, c: CardInstance): boolean =>
  (EXPANSION_SERIALS as readonly number[]).includes(c.serial) && c.templateId === cardId(s.config.expansion, c.serial);

/** Mini-extensions encore jouables : partie terminée, carte jamais sortie de la boîte. */
export function availableExpansions(s: GameState): InstanceId[] {
  if (s.phase !== "gameOver" || inExpansion(s)) return [];
  return s.zones.box.filter((id) => isMiniCard(s, instance(s, id)));
}

/** Grande extension déjà jouée (ou lancée) dans ce royaume : chacune ne se joue qu'une fois. */
const grandStarted = (s: GameState, expansion: string): boolean =>
  s.campaign?.grand === expansion || (s.campaign?.played ?? []).some((p) => p.expansion === expansion);

/** Grandes extensions dont les cartes sont chargées (catalogue), dans l'ordre de GRAND_EXPANSIONS. */
export function grandExpansions(catalog: Catalog): string[] {
  return Object.keys(GRAND_EXPANSIONS).filter((id) => catalog.templates.has(cardId(id, 0)));
}

/** Grandes extensions jouables maintenant : partie terminée, aucune extension en cours, jamais jouée. */
export function availableGrandExpansions(catalog: Catalog, s: GameState): string[] {
  if (s.phase !== "gameOver" || inExpansion(s)) return [];
  return grandExpansions(catalog).filter((id) => !grandStarted(s, id));
}

/**
 * Lance une grande extension (parchemin Merchants 00) : ses cartes rejoignent la boîte du royaume (rien n'est retiré),
 * le deck est rassemblé et mélangé, puis le parchemin 00 est lu : sa purge, puis la découverte de la carte guide.
 */
export function startGrandExpansion(d: Draft, expansion: string): void {
  const rules = GRAND_EXPANSIONS[expansion];
  if (!rules) return;
  const camp = campaignOf(d.s);
  if (camp.base === null) camp.base = computeScore(d.catalog, d.s).total;
  for (const t of [...d.catalog.templates.values()].filter((x) => x.expansion === expansion).sort((a, b) => a.serial - b.serial)) {
    if (d.s.cards[t.id]) continue;
    d.s.cards[t.id] = { instanceId: t.id, templateId: t.id, serial: t.serial, orientation: { side: "front", rotation: 0 }, stickers: [], checkedBoxes: [...preChecked(t)], crossedOutEffects: [], crossedOutProduction: [] };
    d.s.zones.box.push(t.id);
  }
  // Sans carte guide (Ridding the Woods), l'extension est menée par son parchemin 00 (détruit après lecture).
  camp.current = cardId(expansion, rules.guide ?? 0);
  camp.grand = expansion;
  camp.rounds = 0;
  camp.stageAtRoundStart = null;
  d.s.phase = "playing";
  d.s.finalRound = false;
  d.s.queue = [];
  d.s.turn = 0;
  for (const id of [...d.s.zones.play, ...d.s.zones.discard, ...d.s.zones.blocked]) moveTo(d.s, id, "deck");
  d.s.blocks = {};
  const r = shuffle(d.s.zones.deck, d.s.rng);
  d.s.rng = r.state;
  d.s.zones.deck = r.items;
  d.s.revealCount += 1;
  log(d.s, `Extension : ${rules.name}`);
  pushFront(d, { kind: "discover", card: cardId(expansion, 0) }, { kind: "nextRound" });
}

/** Cases imprimées déjà cochées (Morgan le Fey : la première de ses 9 cases). */
function preChecked(t: CardTemplate): string[] {
  return Object.values(t.stages).flatMap((st) => (st?.name === "Morgan le Fey" && st.checkboxes[0] ? [`${st.id}/${st.checkboxes[0].id}`] : []));
}

/** Parchemin 00 d'une grande extension, après lecture : purge, puis découverte de la carte guide (permanente). */
export function grandParchment(expansion: string): (d: Draft) => void {
  return (d) => {
    const rules = GRAND_EXPANSIONS[expansion];
    if (!rules) return;
    const focus = rules.focus ? ` (focus ${rules.focus.count}{${rules.focus.resource}})` : "";
    log(d.s, `Purge ${rules.packet}${focus}, puis ${rules.permanents} carte${rules.permanents > 1 ? "s" : ""} permanente${rules.permanents > 1 ? "s" : ""}`);
    // La purge a pour source le parchemin 00 qui la demande (il est montré avec la question).
    pushFront(
      d,
      { kind: "trigger", card: cardId(expansion, 0), script: grandPurgeScript(expansion), ctx: {} },
      ...(rules.guide !== undefined ? [{ kind: "discover", card: cardId(expansion, rules.guide) } satisfies FlowStep] : []),
    );
  };
}

/**
 * Fin d'une grande extension (parchemin Merchants 00, verso) : les cartes de l'extension restées dans la boîte et
 * citées par une carte découverte y restent (« derrière » les cartes de la boîte de base) ; les autres sont détruites.
 */
function finishGrand(d: Draft, expansion: string): void {
  const camp = campaignOf(d.s);
  const rules = GRAND_EXPANSIONS[expansion];
  const name = rules?.name ?? expansion;
  const own = Object.values(d.s.cards).filter((c) => template(d.catalog, c.templateId).expansion === expansion);
  const discovered = own.filter((c) => !["box", "destroyed", "purged"].includes(zoneOf(d.s, c.instanceId)));
  const cited = new Set(
    discovered.flatMap((c) => Object.values(template(d.catalog, c.templateId).stages).flatMap((st) => (st ? st.effects.flatMap((e) => discoveredSerials(e.text)) : []))),
  );
  for (const c of own.filter((x) => zoneOf(d.s, x.instanceId) === "box")) {
    if (rules?.keepAll || cited.has(c.serial)) log(d.s, `${name} #${c.serial} reste dans la boîte`);
    else moveTo(d.s, c.instanceId, "destroyed");
  }
  // « After finishing Ridding the Woods, {oneTime}. » (A Certain Lady) : l'effet est rayé, où que soit la carte.
  for (const c of own) {
    for (const [k, st] of Object.entries(template(d.catalog, c.templateId).stages)) {
      for (const e of st?.effects ?? []) {
        const key = `${k}/${e.id}`;
        if (e.text.includes(`After finishing ${name}, {oneTime}`) && !c.crossedOutEffects.includes(key)) c.crossedOutEffects.push(key);
      }
    }
  }
  const score = computeScore(d.catalog, d.s).total;
  camp.played.push({ serial: 0, expansion, name, score });
  camp.current = null;
  delete camp.grand;
  camp.stageAtRoundStart = null;
  d.s.phase = "gameOver";
  d.s.queue = [];
  log(d.s, `Fin de l'extension ${name} : ${score} gloire`);
}

/** Lance une mini-extension : la carte rejoint les permanentes, le deck est rassemblé et mélangé, puis la purge. */
export function startExpansion(d: Draft, card: InstanceId): void {
  const camp = campaignOf(d.s);
  if (camp.base === null) camp.base = computeScore(d.catalog, d.s).total;
  camp.current = card;
  camp.rounds = 0;
  camp.stageAtRoundStart = null;
  d.s.phase = "playing";
  d.s.finalRound = false;
  d.s.queue = [];
  d.s.turn = 0;
  const c = instance(d.s, card);
  c.orientation = { side: "front", rotation: 0 };
  moveTo(d.s, card, "permanent");
  recordDiscovery(d.s, card);
  for (const id of [...d.s.zones.play, ...d.s.zones.discard, ...d.s.zones.blocked]) moveTo(d.s, id, "deck");
  d.s.blocks = {};
  const r = shuffle(d.s.zones.deck, d.s.rng);
  d.s.rng = r.state;
  d.s.zones.deck = r.items;
  d.s.revealCount += 1;
  log(d.s, `Mini-extension : ${expansionName(d, card)}. Purge 12, puis 1 carte permanente`);
  pushFront(d, { kind: "nextRound" });
  queueScript(d, card, PURGE_SCRIPT);
}

// --- Vue de la campagne (tableau des scores, statut du royaume) ---

/**
 * Où en est le royaume. Un royaume n'est jamais clôturé (demande du 2026-10-05) : après la partie de base, il attend la
 * prochaine extension, et quand toutes celles connues sont jouées, il attend les suivantes.
 *   base : partie de base en cours ; expansion : mini-extension en cours ; between : une extension peut être lancée ;
 *   waiting : toutes les extensions disponibles sont jouées, en attente de nouvelles.
 */
export type CampaignStage = "base" | "expansion" | "between" | "waiting";

export function campaignStage(s: GameState, catalog?: Catalog): CampaignStage {
  if (inExpansion(s)) return "expansion";
  if (s.phase !== "gameOver") return "base";
  return availableExpansions(s).length > 0 || (catalog !== undefined && availableGrandExpansions(catalog, s).length > 0) ? "between" : "waiting";
}

/** Une étape de la campagne : la partie de base, puis chaque extension (identifiant : « base » ou numéro de carte). */
export type CampaignStep = {
  id: string;
  kind: "base" | "mini" | "grand";
  name: string;
  status: "done" | "current" | "available" | "upcoming";
  /** Score du royaume à la fin de l'étape (chemin de score), ou null si elle n'est pas finie. */
  score: number | null;
  /** Étape en cours : manche (partie de base) ou manche de l'extension (sur `rounds`). */
  round?: number;
  /** Nombre de manches de l'extension (4 pour les mini-extensions, 5 pour Ridding the Woods…). */
  rounds?: number;
};

export function campaignSteps(catalog: Catalog, s: GameState): CampaignStep[] {
  const camp = s.campaign;
  const baseDone = (camp?.base ?? null) !== null || (s.phase === "gameOver" && !inExpansion(s));
  const baseScore = camp?.base ?? (baseDone ? computeScore(catalog, s).total : null);
  const steps: CampaignStep[] = [
    { id: "base", kind: "base", name: "Partie de base", status: baseDone ? "done" : "current", score: baseScore, ...(baseDone ? {} : { round: s.round }) },
  ];
  const available = new Set(availableExpansions(s));
  for (const c of Object.values(s.cards).filter((x) => isMiniCard(s, x)).sort((a, b) => a.serial - b.serial)) {
    const name = expansionName({ catalog, s }, c.instanceId);
    const played = camp?.played.find((p) => p.serial === c.serial && p.expansion === undefined);
    if (played) steps.push({ id: String(c.serial), kind: "mini", name, status: "done", score: played.score });
    else if (camp?.current === c.instanceId) steps.push({ id: String(c.serial), kind: "mini", name, status: "current", score: null, round: camp.rounds, rounds: 4 });
    else steps.push({ id: String(c.serial), kind: "mini", name, status: available.has(c.instanceId) ? "available" : "upcoming", score: null });
  }
  // Grandes extensions : identifiant = nom de l'extension (« Merchants »).
  const grandOpen = new Set(availableGrandExpansions(catalog, s));
  for (const id of grandExpansions(catalog)) {
    const played = camp?.played.find((p) => p.expansion === id);
    if (played) steps.push({ id, kind: "grand", name: played.name, status: "done", score: played.score });
    else if (camp?.grand === id) steps.push({ id, kind: "grand", name: grandName(id), status: "current", score: null, round: camp.rounds, rounds: GRAND_EXPANSIONS[id]?.rounds ?? 4 });
    else steps.push({ id, kind: "grand", name: grandName(id), status: grandOpen.has(id) ? "available" : "upcoming", score: null });
  }
  return steps;
}

// --- Purge (spec 4.7) ---

const purgeable = (d: Draft, id: InstanceId): boolean =>
  friendly(d, id) && canBeDestroyed(d, id) && !(activeStage(d.catalog, d.s, id)?.cannotBePurged ?? false);

/** Aethan Estate : nombre de cartes qu'elle sauve quand elle est purgée. */
function saves(d: Draft, id: InstanceId): number {
  const text = activeStage(d.catalog, d.s, id)?.text ?? "";
  return Number(/When you purge this card, you may save (\d+) other cards?/.exec(text)?.[1] ?? 0);
}

/**
 * Gloire d'une carte purgée (`together` : nombre de cartes purgées en même temps) : sa gloire, plus Temple of Light
 * (+10 par case cochée), Walled Outpost (+2 par autre carte purgée), Treasure Wagon (5 par production restante),
 * Sobbing (-4) : à la purge seulement.
 */
export function purgeFame(d: Draft, id: InstanceId, together = 1): number {
  const stage = activeStage(d.catalog, d.s, id);
  const text = stage?.text ?? "";
  const bonus = /When you purge this, it is worth \+(\d+)\{fame\} per \{mark\}/.exec(text);
  const marks = stage ? instance(d.s, id).checkedBoxes.filter((k) => k.startsWith(`${stage.id}/`)).length : 0;
  const perOther = /Worth \+(\d+)\{fame\} for each other card purged together with this\./.exec(text);
  const perProduction = /When purged, this is worth (\d+)\{fame\} for each production on it\./.exec(text);
  const whenPurged = /This is worth (-?\d+)\{fame\} when purged\./.exec(text);
  const base = perProduction ? Number(perProduction[1]) * productionCount(d.catalog, d.s, id) : whenPurged ? Number(whenPurged[1]) : cardFame(d.catalog, d.s, id);
  // Invisibility Cloak (Adventures) : « When purged, this is worth double {fame}. »
  const double = stage?.effects.some((e) => e.text === "When purged, this is worth double {fame}.") ? 2 : 1;
  return double * base + (bonus ? Number(bonus[1]) * marks : 0) + (perOther ? Number(perOther[1]) * Math.max(0, together - 1) : 0);
}

/** Prisonniers du royaume (Ridding the Woods) : « After selecting cards for a purge, add up to 2 Prisoners to that purge. » */
const PRISONER_TEXT = "After selecting cards for a purge, add up to 2 Prisoners to that purge.";
function prisoners(d: Draft): InstanceId[] {
  return kingdom(d.s).filter((id) => {
    const stage = activeStage(d.catalog, d.s, id);
    const crossed = instance(d.s, id).crossedOutEffects;
    return stage?.effects.some((e) => e.text === PRISONER_TEXT && !crossed.includes(`${stage.id}/${e.id}`)) ?? false;
  });
}

/**
 * Cartes permanentes d'Adventures qui sauvent des cartes d'une purge en cochant une case chacune : Garrisoned Border
 * (toute carte), Elixir of Eternal Life (personnes), The Green Armor (la personne en armure, sticker 55).
 */
type Protector = { card: InstanceId; keep: (id: InstanceId) => boolean };
function protectors(d: Draft, chosen: readonly InstanceId[]): Protector[] {
  const kinds: Record<string, (id: InstanceId) => boolean> = {
    "Garrisoned Border": () => true,
    "Elixir of Eternal Life": (id) => hasKeyword(d.catalog, d.s, id, "Person"),
    "The Green Armor": (id) => instance(d.s, id).stickers.some((st) => st.keyword === "Armored"),
  };
  return d.s.zones.permanent.flatMap((card): Protector[] => {
    const keep = kinds[activeStage(d.catalog, d.s, card)?.name ?? ""];
    if (!keep || chosen.includes(card)) return [];
    return unmarkedBoxes(d, card).length > 0 && chosen.some((id) => id !== card && keep(id)) ? [{ card, keep }] : [];
  });
}

/** Produit-elle cette ressource ? (« focus 2{wood} ») */
const produces = (d: Draft, id: InstanceId, r: ResourceId): boolean =>
  activeStage(d.catalog, d.s, id)?.production.some((g) => g.options.some((o) => o.includes(r))) ?? false;

/**
 * Purge (spec 4.7) : 1 carte par paquet complet de `size` cartes du deck mélangé (les dernières, moins de `size`, ne
 * sont pas purgées), puis `permanents` cartes permanentes. Mini-extensions : purge 12 et 1 permanente ; Merchants :
 * purge 7 et 2 permanentes ; Ridding the Woods : purge 8 « focus 2{wood} » (tant que 2 cartes qui produisent du bois
 * ne sont pas choisies, il faut en prendre une si le paquet en a) et 2 permanentes. Puis, s'il y en a dans le royaume,
 * jusqu'à 2 Prisonniers ajoutés à la purge ; puis les cartes sauvées par Aethan Estate.
 */
const purgeTrigger = (size: number, permanents: number, focus?: { resource: ResourceId; count: number }): TriggerImpl => {
  const packetCount = (d: Draft): number => Math.floor(d.s.zones.deck.length / size);
  /** Rang de la première réponse « cartes sauvées » : après les paquets, les permanentes et les Prisonniers. */
  const saversFrom = (d: Draft): number => packetCount(d) + 1 + (prisoners(d).length > 0 ? 1 : 0);
  return {
  timing: "manual",
  optional: false,
  ask: (d, card, answers): ChoiceRequest | null => {
    const packets = packetCount(d);
    const i = answers.length;
    if (i < packets) {
      const packet = d.s.zones.deck.slice(i * size, (i + 1) * size).filter((id) => purgeable(d, id));
      if (focus) {
        const chosen = answers.slice(0, i).flatMap(cardsOf).filter((id) => produces(d, id, focus.resource)).length;
        const focused = packet.filter((id) => produces(d, id, focus.resource));
        if (chosen < focus.count && focused.length > 0) {
          return askCards(`Purge : 1 carte à purger (paquet ${i + 1}/${packets}) · focus {${focus.resource}} ${chosen + 1}/${focus.count}`, focused, 1);
        }
      }
      return askCards(`Purge : 1 carte à purger (paquet ${i + 1}/${packets})`, packet, 1);
    }
    if (i === packets) {
      const options = d.s.zones.permanent.filter((id) => id !== card && purgeable(d, id));
      const n = Math.min(permanents, options.length);
      return askCards(n > 1 ? `${n} cartes permanentes à purger` : "Carte permanente à purger", options, n);
    }
    const from = saversFrom(d);
    if (i === packets + 1 && from > packets + 1) {
      const list = prisoners(d);
      return askCardsOrNone("Prisonniers ajoutés à la purge (jusqu'à 2)", list, 1, 2, "Aucun prisonnier");
    }
    const chosen = answers.slice(0, packets + 1).flatMap(cardsOf);
    const savers = chosen.filter((id) => saves(d, id) > 0);
    const saved = answers.slice(from).flatMap(cardsOf);
    const saver = savers[i - from];
    if (saver) {
      const options = chosen.filter((id) => id !== saver && !saved.includes(id));
      return askCards(`${cardName(d.catalog, d.s, saver)} : cartes sauvées de la purge (jusqu'à ${saves(d, saver)})`, options, 0, saves(d, saver));
    }
    const all = [...chosen, ...(from > packets + 1 ? cardsOf(answers[packets + 1]) : [])];
    const prot = protectors(d, all)[i - from - savers.length];
    if (!prot) return null;
    const room = unmarkedBoxes(d, prot.card).length;
    const options = all.filter((id) => !saved.includes(id) && prot.keep(id));
    return askCardsOrNone(`${cardName(d.catalog, d.s, prot.card)} : cartes sauvées de la purge (1 case cochée chacune, jusqu'à ${room})`, options, 1, room, "Aucune");
  },
  run: (d, _card, answers) => {
    const packets = packetCount(d);
    const from = saversFrom(d);
    const chosen = [...answers.slice(0, packets + 1).flatMap(cardsOf), ...(from > packets + 1 ? cardsOf(answers[packets + 1]) : [])];
    const saved = new Set(answers.slice(from).flatMap(cardsOf));
    const purged = chosen.filter((id) => !saved.has(id));
    // Sauvetages d'Adventures : une case cochée par carte sauvée (la dernière case détruit la carte qui protège).
    const nSavers = answers.slice(0, packets + 1).flatMap(cardsOf).filter((id) => saves(d, id) > 0).length;
    protectors(d, chosen).forEach((prot, k) => {
      for (const id of cardsOf(answers[from + nSavers + k])) {
        const next = unmarkedBoxes(d, prot.card)[0];
        if (!next) break;
        markBox(d, prot.card, next.stage, next.id);
        log(d.s, `${cardName(d.catalog, d.s, id)} est sauvée par ${cardName(d.catalog, d.s, prot.card)}`);
        if (next.text?.includes("{destroy}")) moveTo(d.s, prot.card, "destroyed");
      }
    });
    let fame = 0;
    for (const id of purged) {
      const f = purgeFame(d, id, purged.length);
      fame += f;
      log(d.s, `${cardName(d.catalog, d.s, id)} est purgée (${f} {fame})`);
      lostSeafaring(d, id);
      moveTo(d.s, id, "purged");
    }
    for (const id of saved) log(d.s, `${cardName(d.catalog, d.s, id)} est sauvée de la purge`);
    d.s.purgedFame += fame;
    log(d.s, `Gloire purgée : +${fame}, total ${d.s.purgedFame}`);
  },
  };
};

// --- Manches d'une mini-extension ---

/** Début de manche d'une mini-extension (appelé par nextRound) : renvoie true si l'extension vient de se terminer. */
export function expansionRoundStart(d: Draft): boolean {
  const camp = campaignOf(d.s);
  const card = camp.current;
  if (!card) return false;
  // Grande extension : ses manches sont menées par ses cartes (Merchants 01 puis 10) ; elle finit après la dernière.
  const grand = camp.grand;
  if (grand !== undefined) {
    if (camp.rounds >= expansionRounds(d.s)) {
      finishGrand(d, grand);
      return true;
    }
    camp.rounds += 1;
    return false;
  }
  if (zoneOf(d.s, card) !== "permanent" || camp.rounds >= 4) {
    finishExpansion(d, card);
    return true;
  }
  camp.rounds += 1;
  camp.stageAtRoundStart = activeStage(d.catalog, d.s, card)?.id ?? null;
  return false;
}

function finishExpansion(d: Draft, card: InstanceId): void {
  const camp = campaignOf(d.s);
  const score = computeScore(d.catalog, d.s).total;
  camp.played.push({ serial: instance(d.s, card).serial, name: expansionName(d, card), score });
  camp.current = null;
  camp.stageAtRoundStart = null;
  if (zoneOf(d.s, card) !== "destroyed") moveTo(d.s, card, "destroyed");
  d.s.phase = "gameOver";
  d.s.queue = [];
  log(d.s, `Fin de la mini-extension ${expansionName(d, card)} : ${score} gloire`);
}

/**
 * Fin de manche d'une mini-extension, après les effets « End of Round » : l'étape de la carte se termine. Les étapes
 * à action (Royal Decree, Obsolete Farms, Resistance) ont leur script ; sinon « Then {rotate} / {flip} ». Une carte
 * déjà tournée pendant la manche (Attack : « …, then {rotate} ») ne l'est pas une seconde fois.
 */
export function expansionEnd(d: Draft): void {
  const camp = campaignOf(d.s);
  const card = camp.current;
  if (!card || camp.grand !== undefined || zoneOf(d.s, card) !== "permanent") return;
  const stage = activeStage(d.catalog, d.s, card);
  if (!stage || stage.id !== camp.stageAtRoundStart) return;
  const script = expansionEndScript(instance(d.s, card).serial, stage.id);
  if (d.catalog.triggers.has(script)) {
    queueScript(d, card, script);
    return;
  }
  if (/Then \{rotate\}/.test(stage.text)) turnCard(d, card, "rotate");
  else if (/Then \{flip\}/.test(stage.text)) turnCard(d, card, "flip");
  else if (/destroy this/i.test(stage.text)) destroyCards(d, [card]);
}

const withProduction = (d: Draft, self: InstanceId, keep: (id: InstanceId) => boolean = () => true) =>
  kingdom(d.s).filter((id) => id !== self && productionCount(d.catalog, d.s, id) > 0 && keep(id));

/** Fins d'étape à action. */
function endScripts(): [string, TriggerImpl][] {
  // Royal Decree : « for each {mark} on Uprising, you must cross out 1 production on 1 card. Then destroy this. »
  const decree: TriggerImpl = {
    timing: "manual",
    optional: false,
    ask: (d, card, a) => {
      const marks = instance(d.s, card).checkedBoxes.filter((k) => k.startsWith("3/")).length;
      if (a.length >= marks) return null;
      return askCards(`Production rayée (${a.length + 1}/${marks})`, withProduction(d, card), 1);
    },
    run: (d, card, a) => {
      for (const id of a.flatMap(cardsOf)) if (crossOutProduction(d.catalog, d.s, id)) log(d.s, `${cardName(d.catalog, d.s, id)} : 1 production rayée`);
      destroyCards(d, [card]);
    },
  };
  // Obsolete Farms : « Then destroy this and 1 card with {coin} production. »
  const farms: TriggerImpl = {
    timing: "manual",
    optional: false,
    ask: (d, card, a) =>
      a.length === 0 ? askCards("Carte avec une production de {coin} à détruire", withProduction(d, card, (id) => canBeDestroyed(d, id) && producesCoinD(d, id)), 1) : null,
    run: (d, card, a) => destroyCards(d, [...cardsOf(a[0]), card]),
  };
  // Resistance : « write the amount (max 100) in sticker 16 and add that sticker to 1 land. Then destroy this. »
  const resistance: TriggerImpl = {
    timing: "manual",
    optional: false,
    ask: (d, card, a) => (a.length === 0 ? askCards("Terre qui reçoit le sticker 16", kingdom(d.s).filter((id) => id !== card && isKind(d, id, "Land")), 1) : null),
    run: (d, card, a) => {
      const amount = Math.min(100, instance(d.s, card).tallies?.["4"] ?? 0);
      for (const land of cardsOf(a[0])) {
        const stage = activeStage(d.catalog, d.s, land)?.id;
        if (stage === undefined) continue;
        instance(d.s, land).stickers.push({ sticker: "16", stage, fame: amount });
        log(d.s, `Sticker 16 ({fame}${amount}) sur ${cardName(d.catalog, d.s, land)}`);
      }
      destroyCards(d, [card]);
    },
  };
  return [
    [expansionEndScript(136, 4), decree],
    [expansionEndScript(137, 4), farms],
    [expansionEndScript(138, 4), resistance],
  ];
}

const producesCoinD = (d: Draft, id: InstanceId): boolean =>
  activeStage(d.catalog, d.s, id)?.production.some((g) => g.options.some((o) => o.includes("coin"))) ?? false;

/** Scripts de la campagne (purge, fins d'étape), ajoutés au catalogue des déclencheurs. */
export function campaignScripts(): Map<string, TriggerImpl> {
  return new Map([
    [PURGE_SCRIPT, purgeTrigger(PACKET, 1)],
    ...Object.entries(GRAND_EXPANSIONS).map(([id, r]): [string, TriggerImpl] => [grandPurgeScript(id), purgeTrigger(r.packet, r.permanents, r.focus)]),
    ...endScripts(),
  ]);
}
