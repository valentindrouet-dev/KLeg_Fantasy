import type { CardTemplate, Checkbox, ResourceId, StageId } from "../../data/schema";
import { askCards, askOption, askResources, cardsOf, optionOf, resourcesOf } from "../choice";
import { boxCardsBySerial, discardFromDeck, discoverNormally, discoverSerials, offerDiscovery, playCard } from "../flow";
import {
  addResourceStickerOf,
  addSticker,
  blockCards,
  boostOptions,
  boxesOf,
  canBeDestroyed,
  canPayD,
  checkKey,
  destroyCards,
  discardCards,
  discardablePersons,
  effectGain,
  fameOf,
  friendly,
  hasProduction,
  heldResources,
  isEnemy,
  isKind,
  isPerson,
  isWall,
  keepInPlay,
  kingdom,
  markBox,
  markedCount,
  orientations,
  otherInPlay,
  payD,
  putOnDeck,
  queueScript,
  resetCard,
  sameOrientation,
  setOrientation,
  stageName,
  trackComplete,
  turnCard,
  undiscover,
  unmarkedBoxes,
} from "../ops";
import { restrictions } from "../passives";
import { canAddResourceSticker, crossOutProduction, producedIcons, productionCount, productionGroups } from "../production";
import { shuffle } from "../rng";
import { activeStage, cardName, gain, instance, log, moveTo, template } from "../state";
import type { Answer, ChoiceRequest, Draft, EffectImpl, InstanceId, TriggerCtx, TriggerImpl } from "../types";
import { cardCostOptions, upgradeCost, upgradeOptions } from "../upgrade";
import { upgradeCard } from "../actions";
import { NO_PARAMS, effectKey } from "./registry";
import { FORTRESS_TEXT } from "./substitutes";

// Effets des cartes de Feudal Kingdom (cartes 11 à 135), reconnus à leur texte imprimé exact : toutes les copies
// d'une carte en profitent. Les questions au joueur passent par `ask` (une à la fois, avant tout paiement), puis
// `run` applique l'effet. Décisions de règles : docs/RULES_DECISIONS.md.

type Ask = (d: Draft, card: InstanceId, a: Answer[]) => ChoiceRequest | null;
type Run = (d: Draft, card: InstanceId, a: Answer[]) => void;

/** Effet utilisé comme action : coût en ressources, condition d'usage, questions, application. */
function effect(o: { cost?: readonly ResourceId[]; usable?: (d: Draft, card: InstanceId) => boolean; ask?: Ask; run: Run }): EffectImpl {
  const cost = o.cost ?? [];
  const impl: EffectImpl = {
    params: (d, card) => ((cost.length === 0 || canPayD(d, cost)) && (o.usable?.(d, card) ?? true) ? [NO_PARAMS] : []),
    apply: (d, card, p) => {
      if (cost.length) payD(d, cost);
      o.run(d, card, p.answers ?? []);
    },
  };
  if (cost.length) impl.cost = cost;
  if (o.ask) impl.ask = o.ask;
  return impl;
}

type TriggerSpec = Omit<TriggerImpl, "run" | "ask"> & {
  ask?: (d: Draft, card: InstanceId, a: Answer[], ctx: TriggerCtx) => ChoiceRequest | null;
  run: (d: Draft, card: InstanceId, a: Answer[], ctx: TriggerCtx) => void;
};
const trigger = (t: TriggerSpec): TriggerImpl => t;

// --- Outils ---

const ICON = /\{(\w+)\}/g;
const iconsIn = (text: string): ResourceId[] => [...text.matchAll(ICON)].map((m) => m[1] ?? "");
const RESOURCES = (d: Draft): readonly ResourceId[] => d.catalog.resources;
const icon = (r: string): string => `{${r}}`;
const serialsIn = (text: string): number[] => [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));

/** n-ième question d'une suite : chaque étape reçoit les réponses précédentes et renvoie sa question ou null (fin). */
function steps(...fns: ((d: Draft, card: InstanceId, prev: Answer[]) => ChoiceRequest | null)[]): Ask {
  return (d, card, a) => {
    const fn = fns[a.length];
    return fn ? fn(d, card, a) : null;
  };
}

const anyResources = (n: number) => (d: Draft) => (n > 0 ? askResources(`Choisis ${n} ressource${n > 1 ? "s" : ""}`, RESOURCES(d), n) : null);

/** Personnes en jeu (autres que la carte), Healing Potion comprise. */
const persons = (d: Draft, self: InstanceId) => discardablePersons(d, self);

/** Défaite d'un ennemi selon sa fiche (spec 4.6) : détruit ou retourné, plus son bonus. */
function defeat(d: Draft, enemy: InstanceId, gainAny: ResourceId[]): void {
  const stage = activeStage(d.catalog, d.s, enemy);
  const spec = stage?.defeat;
  if (!stage || !spec) return;
  log(d.s, `${cardName(d.catalog, d.s, enemy)} est vaincu`);
  const text = spec.text ?? "";
  if (spec.kind === "turn") turnCard(d, enemy, "flip");
  else destroyCards(d, [enemy]);
  if (gainAny.length) effectGain(d, gainAny);
  const lagoon = /discover [^(]+\((\d+)\)/.exec(text);
  if (lagoon) discoverSerials(d, [Number(lagoon[1])]);
}

/** Nombre de ressources « any N » d'une défaite (« and gain any 2 resources »). */
const defeatGain = (d: Draft, enemy: InstanceId): number => Number(/gain any (\d+)/.exec(activeStage(d.catalog, d.s, enemy)?.defeat?.text ?? "")?.[1] ?? 0);

/** Applique le texte d'une case qu'on vient de cocher (« Discover Vassal State (135) and {flip} », « {flip} »). */
function applyBoxText(d: Draft, card: InstanceId, text: string | undefined): void {
  if (!text) return;
  const disc = /Discover [^(]+\((\d+)\)/.exec(text);
  if (disc) discoverSerials(d, [Number(disc[1])]);
  if (text.includes("{flip}")) turnCard(d, card, "flip");
  else if (text.includes("{rotate}")) turnCard(d, card, "rotate");
}

/** Coche la prochaine case libre (de gauche à droite) du stage actif et applique son texte. */
function markNext(d: Draft, card: InstanceId, payCost = false): boolean {
  const next = unmarkedBoxes(d, card)[0];
  if (!next) return false;
  if (payCost && next.cost?.length) payD(d, next.cost);
  markBox(d, card, next.stage, next.id);
  applyBoxText(d, card, next.text);
  return true;
}

/** Une piste de carte permanente (Army, Treasury…) : prochaine case libre, sans payer (Trebuchet, Mass Export). */
const trackCards = (d: Draft, except: InstanceId | null): InstanceId[] =>
  d.s.zones.permanent.filter((id) => id !== except && unmarkedBoxes(d, id).length > 0);

const stickerLabel = (n: string, r: ResourceId | undefined, fame?: number): string =>
  `Sticker ${n}${r ? ` ${icon(r)}` : fame !== undefined ? ` {fame}${fame}` : ""}`;

/** Stickers de la planche cités par numéro sur les cartes. */
const STICKER_DEF: Record<string, { resource?: ResourceId; fame?: number; staysInPlay?: boolean; keyword?: string }> = {
  "1": { resource: "coin" },
  "2": { resource: "wood" },
  "3": { resource: "stone" },
  "4": { resource: "metal" },
  "5": { resource: "sword" },
  "6": { resource: "tradeGood" },
  "7": { staysInPlay: true },
  "8": { fame: 2 },
  "10": { fame: 5 },
  "11": { keyword: "Knight" },
};

function placeSticker(d: Draft, card: InstanceId, n: string): void {
  const def = STICKER_DEF[n];
  if (!def) return;
  addSticker(d, card, { sticker: n, ...def });
}

const labelFor = (n: string): string => {
  const def = STICKER_DEF[n];
  return stickerLabel(n, def?.resource, def?.fame) + (def?.staysInPlay ? " (Stays in play)" : "") + (def?.keyword ? ` (${def.keyword})` : "");
};

// --- Effets utilisés comme action, par texte exact ---

type Factory = (t: CardTemplate, stage: StageId) => EffectImpl | null;

const gainProductionOf = (keyword: string): Factory => () =>
  effect({
    usable: (d, card) => otherInPlay(d, card, (id) => isKind(d, id, keyword) && hasProduction(d, id)).length > 0,
    ask: (d, card, a) => {
      if (a.length === 0) return askCards(`Choisis : ${keyword}`, otherInPlay(d, card, (id) => isKind(d, id, keyword) && hasProduction(d, id)), 1);
      const target = cardsOf(a[0])[0];
      if (!target) return null;
      const slash = productionGroups(d.catalog, d.s, target).filter((g) => g.options.length > 1);
      const g = slash[a.length - 1];
      return g ? askOption("Quelle production ?", g.options.map((o) => o.map(icon).join(""))) : null;
    },
    run: (d, _card, a) => {
      const target = cardsOf(a[0])[0];
      if (!target) return;
      const groups = productionGroups(d.catalog, d.s, target);
      let k = 1;
      const choices = groups.map((g) => (g.options.length > 1 ? Math.max(0, optionOf(a[k++])) : 0));
      gain(d.s, producedIcons(groups, choices));
    },
  });

const gainAnyThen = (n: number, arrow: "rotate" | "flip" | null): Factory => () =>
  effect({
    ask: steps(anyResources(n)),
    run: (d, card, a) => {
      effectGain(d, resourcesOf(a[0]));
      if (arrow) turnCard(d, card, arrow);
    },
  });

const discardThenGain = (label: string, pick: (d: Draft, self: InstanceId) => InstanceId[], count: number, then: (d: Draft, self: InstanceId, a: Answer[]) => void, more?: Ask): Factory => () =>
  effect({
    usable: (d, card) => pick(d, card).length >= count,
    ask: (d, card, a) => (a.length === 0 ? askCards(label, pick(d, card), count) : (more?.(d, card, a) ?? null)),
    run: (d, card, a) => {
      discardCards(d, cardsOf(a[0]));
      then(d, card, a);
    },
  });

/** « Mark 1 {mark} for each seafaring card in play, including this. When complete, {rotate}. » */
const markPerCount = (count: (d: Draft, card: InstanceId) => number, arrow: "rotate" | "flip" | null): Factory => () =>
  effect({
    run: (d, card) => {
      const stage = activeStage(d.catalog, d.s, card)?.id;
      for (let i = count(d, card); i > 0 && markNext(d, card); i--);
      if (arrow && stage !== undefined && trackComplete(d, card, stage)) turnCard(d, card, arrow);
    },
  });

/** Joue une carte de la défausse qui remplit la condition. */
const playFromDiscard = (label: string, keep: (d: Draft, id: InstanceId) => boolean, cost: ResourceId[] = []): Factory => () =>
  effect({
    cost,
    usable: (d, card) => d.s.zones.discard.some((id) => id !== card && keep(d, id)),
    ask: steps((d, card) => askCards(label, d.s.zones.discard.filter((id) => id !== card && keep(d, id)), 1)),
    run: (d, _card, a) => {
      for (const id of cardsOf(a[0])) {
        log(d.s, `${cardName(d.catalog, d.s, id)} est jouée depuis la défausse`);
        playCard(d, id);
      }
    },
  });

/** « Destroy one of the following cards in play to discover an improved version of it; Lumberjack - discover card 100 … » */
function improveFactory(text: string): Factory {
  const pairs = [...text.matchAll(/([A-Z][A-Za-z' ]+?) - discover card (\d+)/g)].map((m) => ({ name: (m[1] ?? "").trim(), serial: Number(m[2]) }));
  const targets = (d: Draft, self: InstanceId) =>
    otherInPlay(d, self, (id) => pairs.some((p) => p.name === stageName(d, id)) && canBeDestroyed(d, id));
  return () =>
    effect({
      usable: (d, card) => targets(d, card).length > 0,
      ask: steps((d, card) => askCards("Carte à détruire", targets(d, card), 1)),
      run: (d, _card, a) => {
        for (const id of cardsOf(a[0])) {
          const serial = pairs.find((p) => p.name === stageName(d, id))?.serial;
          destroyCards(d, [id]);
          if (serial !== undefined) discoverSerials(d, [serial]);
        }
      },
    });
}

/** Améliorer une carte en jeu sans finir le tour (Priest, Cardinal, Schools). */
type UpgradeChoice = { card: InstanceId; upgrade: string; discard: InstanceId[]; label: string };

function upgradeChoices(d: Draft, self: InstanceId, opts: { free: boolean; keep: (id: InstanceId) => boolean; extraCost: ResourceId[] }): UpgradeChoice[] {
  const out: UpgradeChoice[] = [];
  for (const id of otherInPlay(d, self, opts.keep)) {
    const stage = activeStage(d.catalog, d.s, id);
    if (!stage) continue;
    for (const o of upgradeOptions(d.catalog, d.s, id)) {
      const target = template(d.catalog, instance(d.s, id).templateId).stages[String(o.upgrade.toStage) as "1"]?.name ?? "?";
      const label = `${cardName(d.catalog, d.s, id)} → ${target}`;
      if (opts.free) {
        out.push({ card: id, upgrade: o.upgrade.id, discard: [], label });
        continue;
      }
      if (!o.cardCost) continue;
      if (!canPayD(d, [...opts.extraCost, ...upgradeCost(d.catalog, d.s, id, o.upgrade)])) continue;
      for (const discard of cardCostOptions(d.catalog, d.s, id, o.cardCost).filter((x) => !x.includes(self))) {
        const extra = discard.length ? ` (défausser ${discard.map((x) => cardName(d.catalog, d.s, x)).join(", ")})` : "";
        out.push({ card: id, upgrade: o.upgrade.id, discard, label: label + extra });
      }
    }
  }
  return out;
}

function applyUpgradeChoice(d: Draft, c: UpgradeChoice, free: boolean): void {
  const u = activeStage(d.catalog, d.s, c.card)?.upgrades.find((x) => x.id === c.upgrade);
  if (!u) return;
  const before = cardName(d.catalog, d.s, c.card);
  if (!free) payD(d, upgradeCost(d.catalog, d.s, c.card, u));
  discardCards(d, c.discard);
  upgradeCard(d, c.card, u);
  log(d.s, `Amélioration : ${before} → ${cardName(d.catalog, d.s, c.card)} (le tour continue)`);
}

const upgradeFactory = (o: { cost: ResourceId[]; free: boolean; keep: (d: Draft, id: InstanceId) => boolean; arrow: "rotate" | "flip" | null }): Factory => () => {
  const choices = (d: Draft, card: InstanceId) => upgradeChoices(d, card, { free: o.free, keep: (id) => o.keep(d, id), extraCost: o.cost });
  return effect({
    cost: o.cost,
    usable: (d, card) => !restrictions(d.catalog, d.s).noUpgrade && choices(d, card).length > 0,
    ask: steps((d, card) => askOption("Quelle amélioration ?", choices(d, card).map((c) => c.label))),
    run: (d, card, a) => {
      // Le coût de l'effet est déjà payé : la même liste se recalcule sans lui.
      const chosen = upgradeChoices(d, card, { free: o.free, keep: (id) => o.keep(d, id), extraCost: [] })[optionOf(a[0])];
      if (chosen) applyUpgradeChoice(d, chosen, o.free);
      if (o.arrow) turnCard(d, card, o.arrow);
    },
  });
};

/** Stickers de ressource 1 à 6 sur une carte choisie. */
const resourceStickerTo = (label: string, pick: (d: Draft, self: InstanceId) => InstanceId[], arrow: "rotate" | null): Factory => () =>
  effect({
    usable: (d, card) => pick(d, card).length > 0,
    ask: steps(
      (d, card) => askCards(label, pick(d, card), 1),
      (d) => askResources("Quel sticker de ressource ?", RESOURCES(d), 1),
    ),
    run: (d, card, a) => {
      const target = cardsOf(a[0])[0];
      const r = resourcesOf(a[1])[0];
      if (target && r) addResourceStickerOf(d, target, r);
      if (arrow) turnCard(d, card, arrow);
    },
  });

/** Piste « Spend the {x} below to … mark 1 {mark} from left to right » : payer la case suivante. */
const payTrack: Factory = () =>
  effect({
    usable: (d, card) => {
      const next = unmarkedBoxes(d, card)[0];
      return next !== undefined && canPayD(d, next.cost ?? []);
    },
    run: (d, card) => {
      markNext(d, card, true);
    },
  });

const EXACT: Record<string, Factory> = {
  "Choose 1 card in play or discard pile. Put it at the bottom of the deck.": () =>
    effect({
      usable: (d, card) => d.s.zones.deck.length > 0 && (otherInPlay(d, card).length > 0 || d.s.zones.discard.length > 0),
      ask: steps((d, card) => askCards("Carte à mettre sous la pioche", [...otherInPlay(d, card), ...d.s.zones.discard], 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => putOnDeck(d, id, "bottom")),
    }),
  "Choose a building in play. Gain its production as resources.": gainProductionOf("Building"),
  "Choose a land in play. Gain its production as resources.": gainProductionOf("Land"),
  "Choose a person in play and gain its production as resources.": gainProductionOf("Person"),
  "Choose a horse with 0-3 production. Spend {coin}{coin} to add any 1 resource sticker to it.": () => {
    const horses = (d: Draft, self: InstanceId) =>
      otherInPlay(d, self, (id) => isKind(d, id, "Horse") && productionCount(d.catalog, d.s, id) <= 3 && canAddResourceSticker(d.catalog, d.s, id));
    return effect({
      cost: ["coin", "coin"],
      usable: (d, card) => horses(d, card).length > 0,
      ask: steps(
        (d, card) => askCards("Quel cheval ?", horses(d, card), 1),
        (d) => askResources("Quel sticker de ressource ?", RESOURCES(d), 1),
      ),
      run: (d, _card, a) => {
        const h = cardsOf(a[0])[0];
        const r = resourcesOf(a[1])[0];
        if (h && r) addResourceStickerOf(d, h, r);
      },
    });
  },
  "Cross out 1 resource icon in an upgrade cost on 1 card in play.": () => {
    const costIcons = (d: Draft, id: InstanceId) => {
      const stage = activeStage(d.catalog, d.s, id);
      if (!stage) return [];
      const crossed = instance(d.s, id).crossedOutCosts ?? [];
      return stage.upgrades.flatMap((u) =>
        u.cost.flatMap((r, i) => (crossed.includes(`${stage.id}/${u.id}/${i}`) ? [] : [{ key: `${stage.id}/${u.id}/${i}`, label: `${u.arrow === "rotate" ? "↓" : "→"} ${icon(r)}`, r, u: u.id }])),
      );
    };
    // Une option par ressource distincte de chaque amélioration (rayer l'une ou l'autre icône identique revient au même).
    const options = (d: Draft, id: InstanceId) => costIcons(d, id).filter((x, i, all) => all.findIndex((y) => y.u === x.u && y.r === x.r) === i);
    const targets = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => costIcons(d, id).length > 0);
    return effect({
      usable: (d, card) => targets(d, card).length > 0,
      ask: steps(
        (d, card) => askCards("Carte dont le coût baisse", targets(d, card), 1),
        (d, _card, a) => {
          const id = cardsOf(a[0])[0];
          return id ? askOption("Icône à rayer", options(d, id).map((o) => o.label)) : null;
        },
      ),
      run: (d, _card, a) => {
        const id = cardsOf(a[0])[0];
        const o = id ? options(d, id)[optionOf(a[1])] : undefined;
        if (!id || !o) return;
        const c = instance(d.s, id);
        c.crossedOutCosts = [...(c.crossedOutCosts ?? []), o.key];
        log(d.s, `${cardName(d.catalog, d.s, id)} : ${o.label} rayé du coût`);
      },
    });
  },
  "Destroy 1 person to {destroy}.": () =>
    effect({
      usable: (d, card) => otherInPlay(d, card, (id) => isPerson(d, id) && canBeDestroyed(d, id)).length > 0,
      ask: steps((d, card) => askCards("Personne à détruire", otherInPlay(d, card, (id) => isPerson(d, id) && canBeDestroyed(d, id)), 1)),
      run: (d, card, a) => destroyCards(d, [...cardsOf(a[0]), card]),
    }),
  "Discard 1 person to discover Stranger (92).": discardThenGain("Personne à défausser", persons, 1, (d) => discoverSerials(d, [92])),
  "Discard 1 person to gain {sword}{sword}{sword}.": discardThenGain("Personne à défausser", persons, 1, (d) => effectGain(d, ["sword", "sword", "sword"])),
  "Discard 1 person with 5 or more {fame} to mark 1 {mark} below.": () => {
    const eligible = (d: Draft, self: InstanceId) => persons(d, self).filter((id) => isPerson(d, id) && fameOf(d, id) >= 5);
    return effect({
      usable: (d, card) => eligible(d, card).length > 0 && unmarkedBoxes(d, card).length > 0,
      ask: steps((d, card) => askCards("Personne (5 gloire ou plus) à défausser", eligible(d, card), 1)),
      run: (d, card, a) => {
        discardCards(d, cardsOf(a[0]));
        markNext(d, card);
      },
    });
  },
  "Discard 2 persons to gain any 3 resources, then {flip}.": discardThenGain("2 personnes à défausser", persons, 2, (d, card, a) => {
    effectGain(d, resourcesOf(a[1]));
    turnCard(d, card, "flip");
  }, (d, _card, a) => (a.length === 1 ? askResources("Choisis 3 ressources", RESOURCES(d), 3) : null)),
  "Discard 3 persons to {flip}.": discardThenGain("3 personnes à défausser", persons, 3, (d, card) => turnCard(d, card, "flip")),
  "Discard 6 friendly cards in play to discover an artifact (108).": discardThenGain("6 cartes amies à défausser", (d, self) => otherInPlay(d, self, (id) => friendly(d, id)), 6, (d) => discoverSerials(d, [108])),
  "Discard Lord Nimrod and spend the resources for 1 box below to mark {mark} it. When complete, {flip}.": () => {
    const nimrod = (d: Draft) => d.s.zones.play.find((id) => stageName(d, id) === "Lord Nimrod");
    const payable = (d: Draft, card: InstanceId) => unmarkedBoxes(d, card).filter((b) => canPayD(d, b.cost ?? []));
    return effect({
      usable: (d, card) => nimrod(d) !== undefined && payable(d, card).length > 0,
      ask: steps((d, card) => askOption("Quelle case ?", payable(d, card).map((b) => (b.cost ?? []).map(icon).join("")))),
      run: (d, card, a) => {
        const box = payable(d, card)[optionOf(a[0])];
        const n = nimrod(d);
        if (!box || !n) return;
        discardCards(d, [n]);
        payD(d, box.cost ?? []);
        markBox(d, card, box.stage, box.id);
        if (trackComplete(d, card, box.stage)) turnCard(d, card, "flip");
      },
    });
  },
  "Discard a land to gain any 2 resources.": discardThenGain("Terre à défausser", (d, self) => otherInPlay(d, self, (id) => isKind(d, id, "Land")), 1, (d, _c, a) => effectGain(d, resourcesOf(a[1])), (d, _c, a) => (a.length === 1 ? askResources("Choisis 2 ressources", RESOURCES(d), 2) : null)),
  "Discard another card to gain {sword}{sword}.": discardThenGain("Carte à défausser", (d, self) => otherInPlay(d, self), 1, (d) => effectGain(d, ["sword", "sword"])),
  "Discard another person to gain any 2 resources.": discardThenGain("Personne à défausser", persons, 1, (d, _c, a) => effectGain(d, resourcesOf(a[1])), (d, _c, a) => (a.length === 1 ? askResources("Choisis 2 ressources", RESOURCES(d), 2) : null)),
  "Discard any number of persons to write that number in 1 {fame}.": () => {
    const free = (d: Draft, card: InstanceId) => {
      const c = instance(d.s, card);
      return boxesOf(d.catalog, d.s, card).filter((b) => c.written?.[checkKey(b.stage, b.id)] === undefined);
    };
    return effect({
      usable: (d, card) => free(d, card).length > 0 && persons(d, card).length > 0,
      ask: steps((d, card) => askCards("Personnes à défausser", persons(d, card), 1, persons(d, card).length)),
      run: (d, card, a) => {
        const ids = cardsOf(a[0]);
        const box = free(d, card)[0];
        discardCards(d, ids);
        if (!box) return;
        const c = instance(d.s, card);
        c.written = { ...(c.written ?? {}), [checkKey(box.stage, box.id)]: ids.length };
        log(d.s, `${cardName(d.catalog, d.s, card)} : ${ids.length} écrit dans une case de gloire`);
      },
    });
  },
  "Discard the top card of your deck.": () =>
    effect({ usable: (d) => d.s.zones.deck.length > 0, run: (d) => discardFromDeck(d, 1) }),
  "Discover a new region (71 / 72 / 73 / 74). Then {rotate}.": () =>
    effect({
      run: (d, card) => {
        turnCard(d, card, "rotate");
        offerDiscovery(d, boxCardsBySerial(d, [71, 72, 73, 74]), 1, "box", card);
      },
    }),
  "Gain {coin} / {wood} / {stone}.": () =>
    effect({
      ask: steps(() => askOption("Quelle ressource ?", ["{coin}", "{wood}", "{stone}"])),
      run: (d, _card, a) => effectGain(d, [(["coin", "wood", "stone"] as const)[optionOf(a[0])] ?? "coin"]),
    }),
  "Gain {coin} per person in play.": () => effect({ run: (d) => effectGain(d, d.s.zones.play.filter((id) => isPerson(d, id)).map(() => "coin")) }),
  "Gain {sword} for each person in play.": () => effect({ run: (d) => effectGain(d, d.s.zones.play.filter((id) => isPerson(d, id)).map(() => "sword")) }),
  "Mark 1 {mark} for each seafaring card in play, including this. When complete, {flip}.": markPerCount((d) => d.s.zones.play.filter((id) => isKind(d, id, "Seafaring")).length, "flip"),
  "Mark 1 {mark} for each seafaring card in play, including this. When complete, {rotate}.": markPerCount((d) => d.s.zones.play.filter((id) => isKind(d, id, "Seafaring")).length, "rotate"),
  "Mark 1 {mark} for every 2 persons you have in play.": markPerCount((d) => Math.floor(d.s.zones.play.filter((id) => isPerson(d, id)).length / 2), null),
  "Mark 1 {mark} to shuffle your discard pile (without Calendar) and put the top 15 cards of it at the bottom of your deck.": () =>
    effect({
      usable: (d, card) => d.s.zones.deck.length > 0 && unmarkedBoxes(d, card).length > 0,
      run: (d, card) => {
        markNext(d, card);
        const pile = d.s.zones.discard.filter((id) => id !== card);
        const r = shuffle(pile, d.s.rng);
        d.s.rng = r.state;
        const moved = r.items.slice(0, 15);
        for (const id of moved) moveTo(d.s, id, "deck", "bottom");
        d.s.revealCount += 1;
        log(d.s, `${moved.length} carte(s) de la défausse vont sous la pioche`);
      },
    }),
  "Mark 1 {mark}.": () => effect({ usable: (d, card) => unmarkedBoxes(d, card).length > 0, run: (d, card) => void markNext(d, card) }),
  "Mark 1 {mark}. When complete, add sticker 1 as production here.": () =>
    effect({
      usable: (d, card) => unmarkedBoxes(d, card).length > 0,
      run: (d, card) => {
        markNext(d, card);
        const stage = activeStage(d.catalog, d.s, card)?.id;
        if (stage !== undefined && trackComplete(d, card, stage)) addResourceStickerOf(d, card, "coin");
      },
    }),
  "Mark 1 {mark}. When complete, {rotate}.": () =>
    effect({
      usable: (d, card) => unmarkedBoxes(d, card).length > 0,
      run: (d, card) => {
        markNext(d, card);
        const stage = activeStage(d.catalog, d.s, card)?.id;
        if (stage !== undefined && trackComplete(d, card, stage)) turnCard(d, card, "rotate");
      },
    }),
  "Mark 1-2 {mark}.": () =>
    effect({
      usable: (d, card) => unmarkedBoxes(d, card).length > 0,
      ask: steps((d, card) => (unmarkedBoxes(d, card).length >= 2 ? askOption("Combien de cases ?", ["1", "2"]) : null)),
      run: (d, card, a) => {
        markNext(d, card);
        if (optionOf(a[0]) === 1) markNext(d, card);
      },
    }),
  "Mark any 1 {mark} below to discard 1 enemy.": () => {
    const enemies = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isEnemy(d, id));
    return effect({
      usable: (d, card) => enemies(d, card).length > 0 && unmarkedBoxes(d, card).length > 0,
      ask: steps(
        (d, card) => askCards("Ennemi à défausser", enemies(d, card), 1),
        (d, card) => askOption("Quelle case ?", unmarkedBoxes(d, card).map((b) => (b.gain?.length ? `+${b.gain.map(icon).join("")}` : "—"))),
      ),
      run: (d, card, a) => {
        const box = unmarkedBoxes(d, card)[optionOf(a[1])];
        if (box) markBox(d, card, box.stage, box.id);
        discardCards(d, cardsOf(a[0]));
      },
    });
  },
  "Play 1 Wall or 1 knight from discard pile.": playFromDiscard("Mur ou chevalier", (d, id) => isWall(d, id) || isKind(d, id, "Knight")),
  "Play a seafaring card from discard pile.": playFromDiscard("Carte maritime", (d, id) => isKind(d, id, "Seafaring")),
  "Spend {coin} to play a person from discard pile.": playFromDiscard("Personne", (d, id) => isPerson(d, id), ["coin"]),
  "Put a card in play at the bottom of your deck.": () =>
    effect({
      usable: (d, card) => d.s.zones.deck.length > 0 && otherInPlay(d, card).length > 0,
      ask: steps((d, card) => askCards("Carte à mettre sous la pioche", otherInPlay(d, card), 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => putOnDeck(d, id, "bottom")),
    }),
  "Put up to 3 other cards in play on top or bottom of your deck.": () =>
    effect({
      usable: (d, card) => d.s.zones.deck.length > 0 && otherInPlay(d, card).length > 0,
      ask: (d, card, a) => {
        if (a.length === 0) return askCards("Jusqu'à 3 cartes", otherInPlay(d, card), 1, 3);
        const chosen = cardsOf(a[0]);
        const next = chosen[a.length - 1];
        return next ? askOption(`${cardName(d.catalog, d.s, next)} : dessus ou dessous ?`, ["Dessus", "Dessous"]) : null;
      },
      run: (d, _card, a) => cardsOf(a[0]).forEach((id, i) => putOnDeck(d, id, optionOf(a[i + 1]) === 0 ? "top" : "bottom")),
    }),
  "Reset and mark 1 {mark} on that side if possible. Then discover an invention (97 / 98 / 99) or gain any 1 resource for each {mark}.": () => {
    const marksAfter = (d: Draft, card: InstanceId) => {
      const now = markedCount(d.s, d.catalog, card, 1);
      return now + (unmarkedBoxes(d, card, 1).length > 0 ? 1 : 0);
    };
    return effect({
      ask: (d, card, a) => {
        const n = marksAfter(d, card);
        if (a.length === 0) return askOption("Ensuite ?", ["Découvrir une invention", `Gagner ${n} ressource${n > 1 ? "s" : ""}`]);
        if (a.length === 1 && optionOf(a[0]) === 1 && n > 0) return askResources(`Choisis ${n} ressource${n > 1 ? "s" : ""}`, RESOURCES(d), n);
        return null;
      },
      run: (d, card, a) => {
        resetCard(d, card);
        const box = unmarkedBoxes(d, card, 1)[0];
        if (box) markBox(d, card, 1, box.id);
        if (optionOf(a[0]) === 0) offerDiscovery(d, boxCardsBySerial(d, [97, 98, 99]), 1, "box", card);
        else effectGain(d, resourcesOf(a[1]));
      },
    });
  },
  "Reset this card to gain {sword}{sword}{sword}.": () => effect({ run: (d, card) => (resetCard(d, card), effectGain(d, ["sword", "sword", "sword"])) }),
  "Reset this card to gain {tradeGood}{tradeGood}{tradeGood}{tradeGood}{tradeGood}.": () =>
    effect({ run: (d, card) => (resetCard(d, card), effectGain(d, ["tradeGood", "tradeGood", "tradeGood", "tradeGood", "tradeGood"])) }),
  "Reset this.": () => effect({ run: (d, card) => resetCard(d, card) }),
  "Reset to add any resource sticker as production on any stage of this card without stickers.": () => {
    const stages = (d: Draft, card: InstanceId) => {
      const c = instance(d.s, card);
      const t = template(d.catalog, c.templateId);
      return ([1, 2, 3, 4] as const).filter((n) => t.stages[String(n) as "1"] && !c.stickers.some((st) => st.stage === n));
    };
    return effect({
      usable: (d, card) => stages(d, card).length > 0,
      ask: steps(
        (d, card) => {
          const t = template(d.catalog, instance(d.s, card).templateId);
          return askOption("Sur quel stage ?", stages(d, card).map((n) => t.stages[String(n) as "1"]?.name ?? `Stage ${n}`));
        },
        (d) => askResources("Quel sticker de ressource ?", RESOURCES(d), 1),
      ),
      run: (d, card, a) => {
        const stage = stages(d, card)[optionOf(a[0])];
        const r = resourcesOf(a[1])[0];
        if (stage !== undefined && r) addResourceStickerOf(d, card, r, stage);
        resetCard(d, card);
      },
    });
  },
  "Reset to discover Jewellery (90).": () => effect({ run: (d, card) => (resetCard(d, card), discoverSerials(d, [90])) }),
  "Reset to discover Town (105).": () => effect({ run: (d, card) => (resetCard(d, card), discoverSerials(d, [105])) }),
  "Reset to discover 1 building project (78 / 79).": () =>
    effect({ run: (d, card) => (resetCard(d, card), offerDiscovery(d, boxCardsBySerial(d, [78, 79]), 1, "box", card)) }),
  "Spend any 1 resource to gain any 1 resource.": () =>
    effect({
      usable: (d) => heldResources(d).length > 0,
      ask: steps(
        (d) => askResources("Ressource à dépenser", heldResources(d), 1),
        (d) => askResources("Ressource à gagner", RESOURCES(d), 1),
      ),
      run: (d, _card, a) => {
        payD(d, resourcesOf(a[0]));
        effectGain(d, resourcesOf(a[1]));
      },
    }),
  "Spend {coin}{coin} to rotate this card to any orientation.": () => {
    const others = (d: Draft, card: InstanceId) => orientations(d, card).filter((x) => !sameOrientation(x.o, instance(d.s, card).orientation));
    return effect({
      cost: ["coin", "coin"],
      ask: steps((d, card) => {
        const t = template(d.catalog, instance(d.s, card).templateId);
        return askOption("Quelle orientation ?", others(d, card).map((x) => t.stages[String(x.stage) as "1"]?.name ?? `Stage ${x.stage}`));
      }),
      run: (d, card, a) => {
        const o = others(d, card)[optionOf(a[0])];
        if (o) setOrientation(d, card, o.o);
      },
    });
  },
  "Spend {coin}{coin} to upgrade 1 card in play, paying as normal. This does NOT end your turn.": upgradeFactory({ cost: ["coin", "coin"], free: false, keep: () => true, arrow: null }),
  "Upgrade 1 card in play, paying as normal. This does NOT end your turn.": upgradeFactory({ cost: [], free: false, keep: () => true, arrow: null }),
  "Upgrade a person in play for free, then {rotate}.": upgradeFactory({ cost: [], free: true, keep: isPerson, arrow: "rotate" }),
  "Upgrade a person in play for free. Then {flip}.": upgradeFactory({ cost: [], free: true, keep: isPerson, arrow: "flip" }),
  "Spend {coin}{coin}{coin} to convert ({flip}) a Bandit.": () => {
    const bandits = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => stageName(d, id) === "Bandit");
    return effect({
      cost: ["coin", "coin", "coin"],
      usable: (d, card) => bandits(d, card).length > 0,
      ask: steps((d, card) => askCards("Quel bandit ?", bandits(d, card), 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => turnCard(d, id, "flip")),
    });
  },
  "Undiscover this to discover Camelot (106). (Put it back into the box. It may be discovered again.)": () =>
    effect({ run: (d, card) => (undiscover(d, card), discoverSerials(d, [106])) }),
  "Add sticker 6 and 10 to 1 friendly card in play.": () =>
    effect({
      usable: (d, card) => otherInPlay(d, card, (id) => friendly(d, id)).length > 0,
      ask: steps((d, card) => askCards("Carte amie", otherInPlay(d, card, (id) => friendly(d, id)), 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => (placeSticker(d, id, "6"), placeSticker(d, id, "10"))),
    }),
  "Defeat an enemy in play, discard pile, or permanent. Then mark the next {mark} on The Army / Grand Army.": () => {
    const enemies = (d: Draft, self: InstanceId) =>
      [...d.s.zones.play, ...d.s.zones.discard, ...d.s.zones.permanent].filter((id) => id !== self && isEnemy(d, id) && activeStage(d.catalog, d.s, id)?.defeat);
    return effect({
      usable: (d, card) => enemies(d, card).length > 0,
      ask: (d, card, a) => {
        if (a.length === 0) return askCards("Ennemi à vaincre", enemies(d, card), 1);
        const e = cardsOf(a[0])[0];
        const n = e ? defeatGain(d, e) : 0;
        return a.length === 1 && n > 0 ? askResources(`Choisis ${n} ressources`, RESOURCES(d), n) : null;
      },
      run: (d, _card, a) => {
        const e = cardsOf(a[0])[0];
        if (e) defeat(d, e, resourcesOf(a[1]));
        const army = d.s.zones.permanent.find((id) => ["Army", "Grand Army"].includes(stageName(d, id)));
        if (army) markNext(d, army);
      },
    });
  },
  "Destroy 1 {negative} card in play.": () => {
    const targets = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => !friendly(d, id) && canBeDestroyed(d, id));
    return effect({
      usable: (d, card) => targets(d, card).length > 0,
      ask: steps((d, card) => askCards("Carte négative à détruire", targets(d, card), 1)),
      run: (d, _card, a) => destroyCards(d, cardsOf(a[0])),
    });
  },
  "Discard 1 person and spend {stone}{stone}{stone} to mark {mark}.": () =>
    effect({
      cost: ["stone", "stone", "stone"],
      usable: (d, card) => persons(d, card).length > 0 && unmarkedBoxes(d, card).length > 0,
      ask: steps((d, card) => askCards("Personne à défausser", persons(d, card), 1)),
      run: (d, card, a) => {
        discardCards(d, cardsOf(a[0]));
        markNext(d, card);
      },
    }),
  "Discard 2 buildings to add sticker 1 to 1 land in play.": () => {
    const buildings = (d: Draft) => d.s.zones.play.filter((id) => isKind(d, id, "Building"));
    const lands = (d: Draft) => d.s.zones.play.filter((id) => isKind(d, id, "Land"));
    return effect({
      usable: (d) => buildings(d).length >= 2 && lands(d).length > 0,
      ask: steps(
        (d) => askCards("2 bâtiments à défausser", buildings(d), 2),
        (d, _card, a) => askCards("Terre qui reçoit le sticker 1", lands(d).filter((id) => !cardsOf(a[0]).includes(id)), 1),
      ),
      run: (d, _card, a) => {
        discardCards(d, cardsOf(a[0]));
        cardsOf(a[1]).forEach((id) => placeSticker(d, id, "1"));
      },
    });
  },
  "Discard the number of persons written for each space to mark 1 {mark} from left to right.": () => {
    const need = (d: Draft, card: InstanceId) => Number(/Discard (\d+)/.exec(unmarkedBoxes(d, card)[0]?.text ?? "")?.[1] ?? 0);
    return effect({
      usable: (d, card) => unmarkedBoxes(d, card).length > 0 && persons(d, card).length >= need(d, card),
      ask: steps((d, card) => askCards(`${need(d, card)} personne(s) à défausser`, persons(d, card), need(d, card))),
      run: (d, card, a) => {
        discardCards(d, cardsOf(a[0]));
        markNext(d, card);
      },
    });
  },
  "Discover Rival and Raid (133 & 134).": () => effect({ run: (d) => discoverSerials(d, [133, 134]) }),
  "Mark 1 {mark} from top to bottom. When you mark a {asterisk}, add sticker 2 as production here.": () =>
    effect({
      usable: (d, card) => unmarkedBoxes(d, card).length > 0,
      run: (d, card) => {
        const box = unmarkedBoxes(d, card)[0];
        if (!box) return;
        markBox(d, card, box.stage, box.id);
        if (box.icon === "asterisk") addResourceStickerOf(d, card, "wood");
      },
    }),
  "Spend {tradeGood}{tradeGood}{tradeGood}{tradeGood} to mark {mark}.": () =>
    effect({ cost: ["tradeGood", "tradeGood", "tradeGood", "tradeGood"], usable: (d, card) => unmarkedBoxes(d, card).length > 0, run: (d, card) => void markNext(d, card) }),
  "Add 1 resource sticker (1-6) to a person in play, then {rotate}.": resourceStickerTo("Personne", (d, self) => otherInPlay(d, self, (id) => isPerson(d, id)), "rotate"),
  "Add 1 resource sticker (1-6) to a person in play.": resourceStickerTo("Personne", (d, self) => otherInPlay(d, self, (id) => isPerson(d, id)), null),
  // Passifs utilisables à volonté (la carte reste en jeu).
  "Discard 1 person to gain {tradeGood}{tradeGood}.": discardThenGain("Personne à défausser", persons, 1, (d) => effectGain(d, ["tradeGood", "tradeGood"])),
  "Spend {tradeGood}{tradeGood}{tradeGood} to gain any 1 resource.": () =>
    effect({ cost: ["tradeGood", "tradeGood", "tradeGood"], ask: steps(anyResources(1)), run: (d, _card, a) => effectGain(d, resourcesOf(a[0])) }),
  "Spend {sword}{sword}{sword}{sword} to cross out 1 {sword} cost here.": () => {
    const swordIcon = (d: Draft, card: InstanceId) => {
      const stage = activeStage(d.catalog, d.s, card);
      const crossed = instance(d.s, card).crossedOutCosts ?? [];
      for (const u of stage?.upgrades ?? []) {
        const i = u.cost.findIndex((r, idx) => r === "sword" && !crossed.includes(`${stage?.id}/${u.id}/${idx}`));
        if (i >= 0) return `${stage?.id}/${u.id}/${i}`;
      }
      return null;
    };
    return effect({
      cost: ["sword", "sword", "sword", "sword"],
      usable: (d, card) => swordIcon(d, card) !== null,
      run: (d, card) => {
        const key = swordIcon(d, card);
        if (!key) return;
        const c = instance(d.s, card);
        c.crossedOutCosts = [...(c.crossedOutCosts ?? []), key];
        log(d.s, `${cardName(d.catalog, d.s, card)} : 1 {sword} rayé du coût`);
      },
    });
  },
  "Spend {tradeGood} here and keep track of how much you have spent.": () => tallyEffect,
  "Spend {tradeGood} here and keep track of how much you have spent below.": () => tallyEffect,
};

/** Export : dépenser des marchandises ici (compteur par stage). */
const tallyEffect: EffectImpl = effect({
  usable: (d) => (d.s.resources.tradeGood ?? 0) > 0,
  ask: steps((d) => askOption("Combien de {tradeGood} ?", Array.from({ length: d.s.resources.tradeGood ?? 0 }, (_, i) => String(i + 1)))),
  run: (d, card, a) => deposit(d, card, optionOf(a[0]) + 1),
});

function deposit(d: Draft, card: InstanceId, n: number): void {
  const stage = activeStage(d.catalog, d.s, card)?.id;
  if (stage === undefined || n <= 0) return;
  payD(d, Array.from({ length: n }, () => "tradeGood"));
  const c = instance(d.s, card);
  const key = String(stage);
  c.tallies = { ...(c.tallies ?? {}), [key]: (c.tallies?.[key] ?? 0) + n };
  log(d.s, `${cardName(d.catalog, d.s, card)} : ${n} {tradeGood} dépensée(s), total ${c.tallies[key]}`);
}

/** Effets reconnus par motif. */
const PATTERNS: [RegExp, (m: RegExpExecArray) => Factory][] = [
  // « Gain any 3 resources, then {rotate}. », « Gain any 1 resource. »
  [/^Gain any (\d+) resources?(?:, then \{(rotate|flip)\})?\.$/, (m) => gainAnyThen(Number(m[1]), (m[2] as "rotate" | "flip" | undefined) ?? null)],
  // « Gain {sword}{sword}{sword}. » (cartes « destroy »)
  [/^Gain ((?:\{\w+\})+)\.$/, (m) => () => effect({ run: (d) => effectGain(d, iconsIn(m[1] ?? "")) })],
  // « Spend {coin}{coin} to gain any 1 resource. »
  [/^Spend ((?:\{\w+\})+) to gain any (\d+) resources?\.$/, (m) => () => effect({ cost: iconsIn(m[1] ?? ""), ask: steps(anyResources(Number(m[2]))), run: (d, _c, a) => effectGain(d, resourcesOf(a[0])) })],
  // « Spend {coin}{coin}{coin} to discover Missionary (103). », « … a building project (88 / 89). »
  [/^Spend ((?:\{\w+\})+) to discover [^(]+\(([\d /]+)\)\.$/, (m) => () => {
    const serials = serialsIn(m[2] ?? "");
    return effect({
      cost: iconsIn(m[1] ?? ""),
      run: (d, card) => (serials.length > 1 ? offerDiscovery(d, boxCardsBySerial(d, serials), 1, "box", card) : discoverSerials(d, serials)),
    });
  }],
  // « Spend {coin}{coin} to mark 1 {mark}. », « … to mark 1-2 {mark}. »
  [/^Spend ((?:\{\w+\})+) to mark 1(-2)? \{mark\}\.$/, (m) => () =>
    effect({
      cost: iconsIn(m[1] ?? ""),
      usable: (d, card) => unmarkedBoxes(d, card).length > 0,
      ask: m[2] ? steps((d, card) => (unmarkedBoxes(d, card).length >= 2 ? askOption("Combien de cases ?", ["1", "2"]) : null)) : undefined,
      run: (d, card, a) => {
        markNext(d, card);
        if (optionOf(a[0]) === 1) markNext(d, card);
      },
    })],
  // « Spend {metal}{metal}{metal} to add sticker 5 here. »
  [/^Spend ((?:\{\w+\})+) to add sticker (\d+) here\.$/, (m) => () => effect({ cost: iconsIn(m[1] ?? ""), run: (d, card) => placeSticker(d, card, m[2] ?? "") })],
  // Défaites : « Spend {sword}{sword} to defeat ({destroy}) and gain any 2 resources. », « … ({flip}). », « …, then discover Lagoon (77). »
  [/^Spend ((?:\{\w+\})+) to defeat \(\{(destroy|flip)\}\)(.*)\.$/, (m) => () => {
    const n = Number(/gain any (\d+)/.exec(m[3] ?? "")?.[1] ?? 0);
    return effect({
      cost: iconsIn(m[1] ?? ""),
      ask: n > 0 ? steps(anyResources(n)) : undefined,
      run: (d, card, a) => defeat(d, card, resourcesOf(a[0])),
    });
  }],
  // « Destroy one of the following cards in play to discover an improved version of it; … »
  [/^Destroy one of the following cards in play to discover an improved version of it;/, (m) => improveFactory(m.input)],
  // « Look at cards 111 and 112. Destroy 1 of them and discover the other. »
  [/^Look at cards (\d+) and (\d+)\. Destroy 1 of them and discover the other\.$/, (m) => () =>
    effect({ run: (d, card) => offerDiscovery(d, boxCardsBySerial(d, [Number(m[1]), Number(m[2])]), 1, "destroy", card) })],
  // Pistes : « Spend the {sword} below to improve your army: mark 1 {mark} from left to right. … »
  [/^Spend the \{\w+\} below to /, () => payTrack],
];

/** Registre des effets utilisés comme action (activated, time, destroy, passifs à volonté). */
export function cardEffects(templates: Iterable<CardTemplate>): Map<string, EffectImpl> {
  const out = new Map<string, EffectImpl>();
  for (const t of templates) {
    for (const [key, stage] of Object.entries(t.stages)) {
      if (!stage) continue;
      const sid = Number(key) as StageId;
      for (const e of stage.effects) {
        if (e.type === "triggeredForced" || e.type === "triggeredOptional") continue;
        let factory: Factory | undefined = EXACT[e.text];
        if (!factory) {
          for (const [re, make] of PATTERNS) {
            const m = re.exec(e.text);
            if (m) {
              factory = make(m);
              break;
            }
          }
        }
        const impl = factory?.(t, sid);
        if (impl) out.set(effectKey(t.id, sid, e.id), impl);
      }
    }
  }
  return out;
}

// --- Effets déclenchés ---

const blockOnPlay = (label: string, eligible: (d: Draft, self: InstanceId, id: InstanceId) => boolean, count: number): TriggerImpl => {
  const options = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => eligible(d, self, id));
  return trigger({
    timing: "played",
    optional: false,
    when: (d, card) => d.s.zones.play.includes(card) && options(d, card).length > 0,
    ask: (d, card, a) => (a.length === 0 && options(d, card).length > count ? askCards(label, options(d, card), count) : null),
    run: (d, card, a) => blockCards(d, card, a.length ? cardsOf(a[0]) : options(d, card).slice(0, count)),
  });
};

const producesCoin = (d: Draft, id: InstanceId) => productionGroups(d.catalog, d.s, id).some((g) => g.options.some((o) => o.includes("coin")));

/** « Discard to make [up to] N [other] card(s)/person(s) stay in play. » et variantes sans défausse. */
function stayTrigger(text: string): TriggerImpl | null {
  const m = /^End of Turn: (Discard to make|Make) (up to )?(\d+|another|this or another) ?(other )?(cards?|persons?)? ?stay in play\.$/.exec(text);
  if (!m) return null;
  const discardSelf = m[1] === "Discard to make";
  const upTo = m[2] !== undefined;
  const includeSelf = m[3] === "this or another";
  const n = m[3] === "another" || m[3] === "this or another" ? 1 : Number(m[3]);
  const onlyPersons = (m[5] ?? "").startsWith("person");
  const options = (d: Draft, self: InstanceId) =>
    d.s.zones.play.filter((id) => (includeSelf || id !== self) && (!onlyPersons || isPerson(d, id)));
  return trigger({
    timing: "endTurn",
    optional: true,
    when: (d, card) => d.s.zones.play.includes(card) && options(d, card).length > 0,
    ask: steps((d, card) => askCards(`Carte(s) qui restent en jeu`, options(d, card), upTo ? 1 : n, n)),
    run: (d, card, a) => {
      keepInPlay(d, cardsOf(a[0]));
      if (discardSelf) {
        d.s.keepInPlay = (d.s.keepInPlay ?? []).filter((id) => id !== card);
        discardCards(d, [card]);
      }
    },
  });
}

/** Coût en cartes du royaume (fin de manche : tout est dans la défausse). */
const inKingdom = (d: Draft, keep: (id: InstanceId) => boolean) => kingdom(d.s).filter(keep);

const destroyInKingdomThen = (label: string, n: number, keep: (d: Draft, id: InstanceId) => boolean, arrow: "flip" | null): TriggerImpl => {
  const options = (d: Draft, self: InstanceId) => inKingdom(d, (id) => id !== self && keep(d, id) && canBeDestroyed(d, id));
  return trigger({
    timing: "endRound",
    optional: false,
    ask: (d, card, a) => (a.length === 0 && options(d, card).length > n ? askCards(label, options(d, card), n) : null),
    run: (d, card, a) => {
      destroyCards(d, a.length ? cardsOf(a[0]) : options(d, card).slice(0, n));
      if (arrow) turnCard(d, card, arrow);
    },
  });
};

const discardOnPlay = (label: string, n: number, pick: (d: Draft, self: InstanceId) => InstanceId[]): TriggerImpl =>
  trigger({
    timing: "played",
    optional: false,
    when: (d, card) => pick(d, card).length > 0,
    ask: (d, card, a) => (a.length === 0 && pick(d, card).length > n ? askCards(label, pick(d, card), n) : null),
    run: (d, card, a) => discardCards(d, a.length ? cardsOf(a[0]) : pick(d, card).slice(0, n)),
  });

/** Stranger : « 2nd play: add sticker 5 / 10 here. », « 3rd play: Add any resource production sticker here (1-6). » */
function playCountTrigger(text: string): TriggerImpl | null {
  const m = /^(1st|2nd|3rd) play: (.+)$/.exec(text);
  if (!m) return null;
  const nth = Number((m[1] ?? "1")[0]);
  const rest = m[2] ?? "";
  const when = (d: Draft, card: InstanceId) => (instance(d.s, card).plays ?? 0) === nth && d.s.zones.play.includes(card);
  if (/Give (her|him) a name!/.test(rest)) return trigger({ timing: "played", optional: false, when, run: () => undefined });
  const pair = /add sticker (\d+) \/ (\d+) here\./i.exec(rest);
  if (pair) {
    const choices = [pair[1] ?? "", pair[2] ?? ""];
    return trigger({
      timing: "played",
      optional: false,
      when,
      ask: steps(() => askOption("Quel sticker ?", choices.map(labelFor))),
      run: (d, card, a) => placeSticker(d, card, choices[optionOf(a[0])] ?? choices[0] ?? ""),
    });
  }
  if (/Add any resource production sticker here/.test(rest)) {
    return trigger({
      timing: "played",
      optional: false,
      when,
      ask: steps((d) => askResources("Quel sticker de ressource ?", RESOURCES(d), 1)),
      run: (d, card, a) => {
        const r = resourcesOf(a[0])[0];
        if (r) addResourceStickerOf(d, card, r);
      },
    });
  }
  return null;
}

/** Export / Mass Export : cases atteintes par les marchandises dépensées, utilisées entre deux manches. */
function exportBoxes(d: Draft, card: InstanceId): (Checkbox & { stage: StageId })[] {
  const stage = activeStage(d.catalog, d.s, card)?.id;
  if (stage === undefined) return [];
  const tally = instance(d.s, card).tallies?.[String(stage)] ?? 0;
  return unmarkedBoxes(d, card).filter((b) => (b.threshold ?? Infinity) <= tally);
}

/** Questions et application du texte d'une case d'Export. */
function exportAsk(d: Draft, card: InstanceId, box: Checkbox, a: Answer[]): ChoiceRequest | null {
  const text = box.text ?? "";
  const sticker = /^Sticker ([\d /]+) on (1|2|any) (different )?(land|person|building|friendly card|card)s?\.$/.exec(text);
  if (sticker) {
    const numbers = (sticker[1] ?? "").split("/").map((x) => x.trim());
    const count = sticker[2] === "2" ? 2 : 1;
    const kind = sticker[4] ?? "card";
    const targets = inKingdom(d, (id) =>
      kind === "land" ? isKind(d, id, "Land") : kind === "person" ? isPerson(d, id) : kind === "building" ? isKind(d, id, "Building") : kind === "friendly card" ? friendly(d, id) : true,
    );
    if (a.length === 0 && numbers.length > 1) return askOption("Quel sticker ?", numbers.map(labelFor));
    const asked = numbers.length > 1 ? 1 : 0;
    if (a.length === asked) return askCards("Sur quelle carte ?", targets, count);
    return null;
  }
  if (text.startsWith("{mark} 1 other permanent card")) return a.length === 0 ? askCards("Carte permanente", trackCards(d, card), 1) : null;
  if (text.startsWith("{mark} all other permanent cards")) return a.length === 0 ? askCards("Cartes permanentes", trackCards(d, card), 0, trackCards(d, card).length) : null;
  return null;
}

function exportRun(d: Draft, card: InstanceId, box: Checkbox & { stage: StageId }, a: Answer[]): void {
  markBox(d, card, box.stage, box.id);
  const text = box.text ?? "";
  const sticker = /^Sticker ([\d /]+) on/.exec(text);
  if (sticker) {
    const numbers = (sticker[1] ?? "").split("/").map((x) => x.trim());
    const n = numbers.length > 1 ? numbers[optionOf(a[0])] : numbers[0];
    const targets = cardsOf(a[numbers.length > 1 ? 1 : 0]);
    for (const id of targets) placeSticker(d, id, n ?? "");
    return;
  }
  if (text.startsWith("{mark}")) {
    for (const id of cardsOf(a[0])) markNext(d, id);
    return;
  }
  applyBoxText(d, card, text);
}

const exportTrigger = (): TriggerImpl =>
  trigger({
    timing: "betweenRounds",
    optional: true,
    prompt: "Export : utiliser une case atteinte ?",
    when: (d, card) => exportBoxes(d, card).length > 0,
    ask: (d, card, a) => {
      const boxes = exportBoxes(d, card);
      if (a.length === 0) return boxes.length > 1 ? askOption("Quelle case ?", boxes.map((b) => `${b.threshold ?? ""} {tradeGood} : ${b.text ?? ""}`)) : exportAsk(d, card, boxes[0] as Checkbox, []);
      const first = boxes.length > 1 ? optionOf(a[0]) : 0;
      const box = boxes[first];
      return box ? exportAsk(d, card, box, boxes.length > 1 ? a.slice(1) : a) : null;
    },
    run: (d, card, a) => {
      const boxes = exportBoxes(d, card);
      const multi = boxes.length > 1;
      const box = boxes[multi ? optionOf(a[0]) : 0];
      if (!box) return;
      exportRun(d, card, box, multi ? a.slice(1) : a);
      const key = effectKey(instance(d.s, card).templateId, box.stage, activeStage(d.catalog, d.s, card)?.effects.find((e) => e.type === "triggeredOptional")?.id ?? "e2");
      if (exportBoxes(d, card).length > 0) queueScript(d, card, key);
    },
  });

const TRIGGERS: Record<string, () => TriggerImpl> = {
  "When played, blocks 1 card with {coin} production.": () => blockOnPlay("Carte bloquée", (d, _s, id) => friendly(d, id) && producesCoin(d, id), 1),
  "When played, blocks 3 cards with production.": () => blockOnPlay("3 cartes bloquées", (d, _s, id) => friendly(d, id) && hasProduction(d, id), 3),
  "When played, blocks 1 building / land in play.": () => blockOnPlay("Carte bloquée", (d, _s, id) => isKind(d, id, "Building") || isKind(d, id, "Land"), 1),
  "Blocks all buildings (max 5 blocked buildings here).": () => {
    // Joué : tous les bâtiments en jeu ; ensuite, ceux qui arrivent tant que Flooding est en jeu (5 au plus).
    const room = (d: Draft, card: InstanceId) => 5 - (d.s.blocks?.[card]?.length ?? 0);
    const options = (d: Draft, card: InstanceId, ctx: TriggerCtx) =>
      otherInPlay(d, card, (id) => isKind(d, id, "Building") && ((ctx.cards ?? []).includes(card) || (ctx.cards ?? []).includes(id)));
    return trigger({
      timing: ["played", "otherPlayed"],
      optional: false,
      when: (d, card, ctx) => d.s.zones.play.includes(card) && room(d, card) > 0 && options(d, card, ctx).length > 0,
      ask: (d, card, a, ctx) => {
        const opts = options(d, card, ctx);
        return a.length === 0 && opts.length > room(d, card) ? askCards("Bâtiments bloqués", opts, room(d, card)) : null;
      },
      run: (d, card, a, ctx) => blockCards(d, card, a.length ? cardsOf(a[0]) : options(d, card, ctx).slice(0, room(d, card))),
    });
  },
  "When played, discard the next 3 cards of your deck, then {flip}.": () =>
    trigger({ timing: "played", optional: false, run: (d, card) => (discardFromDeck(d, 3), turnCard(d, card, "flip")) }),
  "When played, discard the next 2 cards from your deck.": () => trigger({ timing: "played", optional: false, run: (d) => discardFromDeck(d, 2) }),
  "When played, discard 2 friendly cards in play.": () => discardOnPlay("2 cartes amies à défausser", 2, (d) => d.s.zones.play.filter((id) => friendly(d, id))),
  "When played, discard 2 persons.": () => discardOnPlay("2 personnes à défausser", 2, (d, self) => persons(d, self)),
  "When played, you must discard any 1 card in play.": () => discardOnPlay("Carte à défausser", 1, (d) => [...d.s.zones.play]),
  "When played, discover Pirate (76).": () => trigger({ timing: "played", optional: false, run: (d) => discoverSerials(d, [76]) }),
  "When played, play a horse from discard pile.": () => {
    const horses = (d: Draft) => d.s.zones.discard.filter((id) => isKind(d, id, "Horse"));
    return trigger({
      timing: "played",
      optional: true,
      when: (d) => horses(d).length > 0,
      ask: steps((d) => askCards("Quel cheval ?", horses(d), 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => playCard(d, id)),
    });
  },
  "While this is in play, destroy the next land you play. When you do, {flip}.": () => nextPlayedTrigger("Land"),
  "Destroy the next person you play. If you do, {flip}.": () => nextPlayedTrigger("Person"),
  "After this produces, cross out 1 production here.": () =>
    trigger({ timing: "produced", optional: false, run: (d, card) => void crossOutProduction(d.catalog, d.s, card) }),
  "End of Turn: {flip}.": () => trigger({ timing: "endTurn", optional: false, run: (d, card) => turnCard(d, card, "flip") }),
  "End of Turn: Discover the next 2 cards from your box, then {flip}.": () =>
    trigger({ timing: "endTurn", optional: false, run: (d, card) => (turnCard(d, card, "flip"), discoverNormally(d, 2)) }),
  "End of Turn: discover the next 2 cards from your box, then {destroy}.": () =>
    trigger({ timing: "endTurn", optional: false, run: (d, card) => (destroyCards(d, [card]), discoverNormally(d, 2)) }),
  "End of Turn: Unfortunately discover Backstabber (94).": () => trigger({ timing: "endTurn", optional: false, run: (d) => discoverSerials(d, [94]) }),
  "End of Turn: discard 2 persons or {rotate}.": () => {
    const others = (d: Draft, card: InstanceId) => persons(d, card);
    return trigger({
      timing: "endTurn",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card),
      ask: (d, card, a) => {
        if (others(d, card).length < 2) return null;
        if (a.length === 0) return askOption("Défausser 2 personnes ou tourner la carte ?", ["Défausser 2 personnes", "Tourner"]);
        return a.length === 1 && optionOf(a[0]) === 0 ? askCards("2 personnes à défausser", others(d, card), 2) : null;
      },
      run: (d, card, a) => {
        if (optionOf(a[0]) === 0) discardCards(d, cardsOf(a[1]));
        else turnCard(d, card, "rotate");
      },
    });
  },
  "End of Turn: If you have no cards in your deck, mark 1 {mark}.": () =>
    trigger({ timing: "endTurn", optional: false, when: (d, card) => d.s.zones.deck.length === 0 && unmarkedBoxes(d, card).length > 0, run: (d, card) => void markNext(d, card) }),
  "End of Turn: If you have no {sword}, cross out 1 production on 1 card in play.": () => {
    const options = (d: Draft) => d.s.zones.play.filter((id) => hasProduction(d, id));
    return trigger({
      timing: "endTurn",
      optional: false,
      when: (d) => (d.s.resources.sword ?? 0) === 0 && options(d).length > 0,
      ask: steps((d) => askCards("Carte dont une production est rayée", options(d), 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => crossOutProduction(d.catalog, d.s, id)),
    });
  },
  "End of Round: Destroy any 2 persons in your kingdom. Then {flip}.": () => destroyInKingdomThen("2 personnes à détruire", 2, isPerson, "flip"),
  "End of Round: Destroy 1 building in your kingdom. Then {flip}.": () => destroyInKingdomThen("Bâtiment à détruire", 1, (d, id) => isKind(d, id, "Building"), "flip"),
  "End of Round: Destroy any 3 friendly non-permanent cards in your kingdom. Then {flip}.": () =>
    destroyInKingdomThen("3 cartes amies à détruire", 3, (d, id) => friendly(d, id) && !d.s.zones.permanent.includes(id), "flip"),
  "End of Round: Destroy the blocked card, if any.": () =>
    trigger({ timing: "endRound", optional: false, when: (_d, _c, ctx) => (ctx.cards ?? []).length > 0, run: (d, _card, _a, ctx) => destroyCards(d, (ctx.cards ?? []).filter((id) => canBeDestroyed(d, id))) }),
  "End of Round: Destroy this and 1 blocked building or any 2 other friendly non-permanent cards.": () => {
    const others = (d: Draft, card: InstanceId) => inKingdom(d, (id) => id !== card && friendly(d, id) && !d.s.zones.permanent.includes(id) && canBeDestroyed(d, id));
    const blocked = (d: Draft, ctx: TriggerCtx) => (ctx.cards ?? []).filter((id) => canBeDestroyed(d, id));
    return trigger({
      timing: "endRound",
      optional: false,
      ask: (d, card, a, ctx) => {
        const hasBlocked = blocked(d, ctx).length > 0;
        if (a.length === 0 && hasBlocked) return askOption("Que détruire ?", ["1 bâtiment bloqué", "2 autres cartes amies"]);
        const useBlocked = hasBlocked && optionOf(a[0]) === 0;
        const idx = hasBlocked ? 1 : 0;
        if (a.length !== idx) return null;
        return useBlocked ? askCards("Bâtiment bloqué à détruire", blocked(d, ctx), 1) : askCards("2 cartes amies à détruire", others(d, card), 2);
      },
      run: (d, card, a, ctx) => {
        const idx = blocked(d, ctx).length > 0 ? 1 : 0;
        destroyCards(d, [...cardsOf(a[idx]), card]);
      },
    });
  },
  "End of Round: Add sticker 1 & 5 & 11 to 1 person. Then {flip}.": () => {
    const options = (d: Draft) => inKingdom(d, (id) => isPerson(d, id));
    return trigger({
      timing: "endRound",
      optional: false,
      ask: steps((d) => (options(d).length ? askCards("Personne adoubée", options(d), 1) : null)),
      run: (d, card, a) => {
        for (const id of cardsOf(a[0])) ["1", "5", "11"].forEach((n) => placeSticker(d, id, n));
        turnCard(d, card, "flip");
      },
    });
  },
  "End of Round: Add sticker 2 / 3 and 4 / 6 to 1 building. Then destroy this.": () => {
    const options = (d: Draft) => inKingdom(d, (id) => isKind(d, id, "Building"));
    return trigger({
      timing: "endRound",
      optional: false,
      ask: steps(
        (d) => (options(d).length ? askCards("Bâtiment rénové", options(d), 1) : null),
        () => askOption("Premier sticker", [labelFor("2"), labelFor("3")]),
        () => askOption("Second sticker", [labelFor("4"), labelFor("6")]),
      ),
      run: (d, card, a) => {
        for (const id of cardsOf(a[0])) {
          placeSticker(d, id, optionOf(a[1]) === 1 ? "3" : "2");
          placeSticker(d, id, optionOf(a[2]) === 1 ? "6" : "4");
        }
        destroyCards(d, [card]);
      },
    });
  },
  "End of Round: Add any resource sticker (1-6) to 1 friendly card, then {rotate}.": () => {
    const options = (d: Draft) => inKingdom(d, (id) => friendly(d, id));
    return trigger({
      timing: "endRound",
      optional: false,
      ask: steps(
        (d) => (options(d).length ? askCards("Carte amie", options(d), 1) : null),
        (d) => askResources("Quel sticker de ressource ?", RESOURCES(d), 1),
      ),
      run: (d, card, a) => {
        const id = cardsOf(a[0])[0];
        const r = resourcesOf(a[1])[0];
        if (id && r) addResourceStickerOf(d, id, r);
        turnCard(d, card, "rotate");
      },
    });
  },
  "When you upgrade this, add sticker 1 to 1 land in play.": () => upgradeStickerTrigger("1"),
  "When you upgrade this, add sticker 7 to 1 land in play.": () => upgradeStickerTrigger("7"),
  "When you upgrade this, boost 1 production in play.": () => {
    const options = (d: Draft) => d.s.zones.play.filter((id) => boostOptions(d, id).length > 0 && canAddResourceSticker(d.catalog, d.s, id));
    return trigger({
      timing: "upgraded",
      optional: true,
      when: (d) => options(d).length > 0,
      ask: steps(
        (d) => askCards("Carte dont la production augmente", options(d), 1),
        (d, _card, a) => {
          const id = cardsOf(a[0])[0];
          const rs = id ? boostOptions(d, id) : [];
          return rs.length > 1 ? askResources("Quelle ressource ?", rs, 1) : null;
        },
      ),
      run: (d, _card, a) => {
        const id = cardsOf(a[0])[0];
        const r = resourcesOf(a[1])[0] ?? (id ? boostOptions(d, id)[0] : undefined);
        if (id && r) addResourceStickerOf(d, id, r);
      },
    });
  },
  'When upgraded, write "20" in an empty {fame} on that stage.': () =>
    trigger({
      timing: "upgraded",
      optional: false,
      run: (d, card) => {
        const c = instance(d.s, card);
        const box = boxesOf(d.catalog, d.s, card, 4).find((b) => c.written?.[checkKey(4, b.id)] === undefined);
        if (!box) return;
        c.written = { ...(c.written ?? {}), [checkKey(4, box.id)]: 20 };
        log(d.s, `${cardName(d.catalog, d.s, card)} : 20 écrit dans une case de gloire`);
      },
    }),
  "Between rounds, you may use effects you have reached enough {tradeGood} for (mark {mark}).": exportTrigger,
  "Between rounds, you may use (and {mark}) effects below you have reached enough {tradeGood} for.": exportTrigger,
  [FORTRESS_TEXT]: () => {
    const walls = (d: Draft, card: InstanceId) => otherInPlay(d, card, (id) => isWall(d, id));
    return trigger({
      timing: "manual",
      optional: true,
      ask: steps((d, card) => askCards("2 murs à défausser", walls(d, card), 2)),
      run: (d, _card, a) => discardCards(d, cardsOf(a[0])),
      decline: (d, card) => discardCards(d, [card]),
    });
  },
  // Parchemin 24 : les deux stickers sont posés (lancés par le parchemin, voir scripts/parchments.ts).
  "Fertile Soil: Add sticker 1 ({coin}) as production to a land.": () => {
    const lands = (d: Draft) => inKingdom(d, (id) => isKind(d, id, "Land") && canAddResourceSticker(d.catalog, d.s, id));
    return trigger({
      timing: "manual",
      optional: false,
      ask: steps((d) => (lands(d).length ? askCards("Fertile Soil : terre qui reçoit le sticker 1", lands(d), 1) : null)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => placeSticker(d, id, "1")),
    });
  },
  "Efficiency: Choose 1 building and boost its production (add a resource sticker to it to make it produce 1 more of a resource it already produces. Resource stickers are numbered 1-6 on the sticker sheet).": () => {
    const buildings = (d: Draft) => inKingdom(d, (id) => isKind(d, id, "Building") && boostOptions(d, id).length > 0 && canAddResourceSticker(d.catalog, d.s, id));
    return trigger({
      timing: "manual",
      optional: false,
      ask: steps(
        (d) => (buildings(d).length ? askCards("Efficiency : bâtiment dont la production augmente", buildings(d), 1) : null),
        (d, _card, a) => {
          const id = cardsOf(a[0])[0];
          const rs = id ? boostOptions(d, id) : [];
          return rs.length > 1 ? askResources("Quelle ressource ?", rs, 1) : null;
        },
      ),
      run: (d, _card, a) => {
        const id = cardsOf(a[0])[0];
        const r = resourcesOf(a[1])[0] ?? (id ? boostOptions(d, id)[0] : undefined);
        if (id && r) addResourceStickerOf(d, id, r);
      },
    });
  },
  // Export : à la fin du tour, les marchandises restantes sont dépensées ici plutôt que perdues.
  "Spend {tradeGood} here and keep track of how much you have spent.": () => tallyEndOfTurn,
  "Spend {tradeGood} here and keep track of how much you have spent below.": () => tallyEndOfTurn,
};

const tallyEndOfTurn: TriggerImpl = trigger({
  timing: "endTurn",
  optional: false,
  when: (d, card) => (d.s.resources.tradeGood ?? 0) > 0 && d.s.zones.permanent.includes(card),
  run: (d, card) => deposit(d, card, d.s.resources.tradeGood ?? 0),
});

function upgradeStickerTrigger(n: string): TriggerImpl {
  const lands = (d: Draft) => d.s.zones.play.filter((id) => isKind(d, id, "Land") && (STICKER_DEF[n]?.resource === undefined || canAddResourceSticker(d.catalog, d.s, id)));
  return trigger({
    timing: "upgraded",
    optional: true,
    when: (d) => lands(d).length > 0,
    ask: steps((d) => askCards(`Terre qui reçoit le sticker ${n}`, lands(d), 1)),
    run: (d, _card, a) => cardsOf(a[0]).forEach((id) => placeSticker(d, id, n)),
  });
}

/** Volcanic Eruption, Assassin : la prochaine carte de ce type jouée (pas en même temps que la source) est détruite. */
function nextPlayedTrigger(keyword: string): TriggerImpl {
  const victims = (d: Draft, ctx: TriggerCtx) => (ctx.cards ?? []).filter((id) => d.s.zones.play.includes(id) && isKind(d, id, keyword) && canBeDestroyed(d, id));
  return trigger({
    timing: "otherPlayed",
    optional: false,
    when: (d, card, ctx) => d.s.zones.play.includes(card) && victims(d, ctx).length > 0,
    ask: (d, _card, a, ctx) => (a.length === 0 && victims(d, ctx).length > 1 ? askCards("Carte détruite", victims(d, ctx), 1) : null),
    run: (d, card, a, ctx) => {
      destroyCards(d, a.length ? cardsOf(a[0]) : victims(d, ctx).slice(0, 1));
      turnCard(d, card, "flip");
    },
  });
}

/** Registre des effets déclenchés. */
export function cardTriggers(templates: Iterable<CardTemplate>): Map<string, TriggerImpl> {
  const out = new Map<string, TriggerImpl>();
  for (const t of templates) {
    for (const [key, stage] of Object.entries(t.stages)) {
      if (!stage) continue;
      const sid = Number(key) as StageId;
      for (const e of stage.effects) {
        const make = TRIGGERS[e.text];
        const impl = make?.() ?? stayTrigger(e.text) ?? playCountTrigger(e.text);
        if (impl) out.set(effectKey(t.id, sid, e.id), impl);
      }
    }
  }
  return out;
}

