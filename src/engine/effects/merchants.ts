import type { Checkbox, EffectType, ResourceId, StageId } from "../../data/schema";
import { usableEffects } from "../actions";
import { campaignOf } from "../campaign";
import { askBox, askCards, askOption, askPersons, askResources, boxOf, cardsOf, optionOf, resourcesOf } from "../choice";
import { boxCardsBySerial, discoverSerials, endTurn, playCards } from "../flow";
import {
  addResourceStickerOf,
  boostOptions,
  canBeDestroyed,
  canPayD,
  destroyCards,
  discardCards,
  effectGain,
  friendly,
  hasProduction,
  isKind,
  isPerson,
  markBox,
  orientations,
  otherInPlay,
  payD,
  putOnDeck,
  resetCard,
  sameOrientation,
  setOrientation,
  trackComplete,
  turnCard,
  unmarkedBoxes,
} from "../ops";
import { timeBlockedFor } from "../passives";
import { canAddResourceSticker, crossOutProduction, producedIcons, productionCount, productionGroups } from "../production";
import { activeStage, cardName, gain, instance, log, personWeight, template } from "../state";
import type { Answer, ChoiceRequest, Draft, EffectImpl, EffectParams, InstanceId, TriggerImpl } from "../types";
import { NO_PARAMS } from "./registry";
import { defeat, effect, icon, labelFor, markNext, persons, placeSticker, STICKER_DEF, steps, trigger } from "./cards";

// Effets des cartes de l'extension Merchants (cartes 00 à 25), reconnus à leur texte imprimé exact comme ceux de
// Feudal Kingdom (effects/cards.ts). Les cartes citées par numéro sont cherchées dans Merchants (withExpansion).
// Lancement, manches et fin de l'extension : campaign.ts. Décisions de règles : docs/RULES_DECISIONS.md.
// Rien ici ne doit appeler cards.ts au chargement du module (import circulaire) : seulement dans les fabriques.

/** « 7{coin} » ou « {coin}{coin} » : les icônes une par une. */
export const expandIcons = (text: string): ResourceId[] =>
  [...text.matchAll(/(\d+)?\{(\w+)\}/g)].flatMap((m) => Array.from({ length: Number(m[1] ?? 1) }, () => m[2] ?? ""));

const iconText = (rs: readonly ResourceId[]): string => rs.map(icon).join("");
const pad = (n: number): string => String(n).padStart(2, "0");

/** Copies identiques (Pair of Camels 24 / 25) : la première encore dans la boîte, sans choix à faire. */
function discoverCopy(d: Draft, serials: readonly number[]): void {
  const id = serials.flatMap((n) => boxCardsBySerial(d, [n]))[0];
  discoverSerials(d, id ? [instance(d.s, id).serial] : serials);
}

const personsInPlay = (d: Draft, self: InstanceId): InstanceId[] => otherInPlay(d, self, (id) => isPerson(d, id));

/** Coche la case suivante ; piste complète : reset (épices). */
function markThenReset(d: Draft, card: InstanceId): void {
  const stage = activeStage(d.catalog, d.s, card)?.id;
  markNext(d, card);
  if (stage !== undefined && trackComplete(d, card, stage)) resetCard(d, card);
}

const hasFreeBox = (d: Draft, card: InstanceId): boolean => unmarkedBoxes(d, card).length > 0;

/** Production d'une carte gagnée comme ressources : une question par groupe à « / » (réponses à partir de `from`). */
function slashQuestion(d: Draft, target: InstanceId, a: Answer[], from: number): ChoiceRequest | null {
  const slash = productionGroups(d.catalog, d.s, target).filter((g) => g.options.length > 1);
  const g = slash[a.length - from];
  return g ? askOption(`${cardName(d.catalog, d.s, target)} : quelle production ?`, g.options.map(iconText)) : null;
}

function gainProductionOf(d: Draft, target: InstanceId, a: Answer[], from: number): number {
  const groups = productionGroups(d.catalog, d.s, target);
  let k = from;
  const choices = groups.map((g) => (g.options.length > 1 ? Math.max(0, optionOf(a[k++])) : 0));
  gain(d.s, producedIcons(groups, choices));
  return k;
}

// --- Merchants 01 et 10 : « Choose one: Spend 7{coin} to discover Camels (02). … » ---

function chooseOneDiscover(text: string): (() => EffectImpl) | null {
  if (!text.startsWith("Choose one: ")) return null;
  const items = [...text.matchAll(/Spend ((?:\d*\{\w+\})+) to discover ([^(.]+?) \((\d+)\)\./g)].map((m) => ({
    cost: expandIcons(m[1] ?? ""),
    name: (m[2] ?? "").trim(),
    serial: Number(m[3]),
  }));
  if (items.length < 2) return null;
  // Un paramètre `option` par choix encore possible (sa carte est dans la boîte) : le joueur le touche dans le menu.
  return () => ({
    params: (d) => items.flatMap((x, i) => (boxCardsBySerial(d, [x.serial]).length > 0 && canPayD(d, x.cost) ? [{ targets: [], option: i }] : [])),
    costOf: (_d, _card, p) => items[p?.option ?? 0]?.cost ?? [],
    labels: () => items.map((x) => `Découvrir ${x.name} (${pad(x.serial)}) pour ${iconText(x.cost)}`),
    apply: (d, _card, p) => {
      const x = items[p.option ?? -1];
      if (!x) return;
      payD(d, x.cost);
      discoverSerials(d, [x.serial]);
    },
  });
}

// --- Pistes permanentes : Weaving, Fishing, Brewing, Basketry, Shoemaking ---

type TrackSpec = { discard: "person" | "seafaring" | null; goods: number; boost: boolean };

/**
 * « Discard 1 person AND spend the {coin} below … mark {mark} from left to right » : la case suivante dit ce qu'il faut
 * défausser (« Discard 2 persons. ») et payer ; Brewing et Basketry rapportent 5 {tradeGood}, Shoemaking booste une
 * personne en jeu.
 */
function track(spec: TrackSpec): () => EffectImpl {
  const next = (d: Draft, card: InstanceId): (Checkbox & { stage: StageId }) | undefined => unmarkedBoxes(d, card)[0];
  const need = (d: Draft, card: InstanceId): number => {
    const b = next(d, card);
    return b && spec.discard ? Number(/Discard (\d+)/.exec(b.text ?? "")?.[1] ?? 1) : 0;
  };
  const pool = (d: Draft, card: InstanceId): InstanceId[] =>
    spec.discard === "person" ? personsInPlay(d, card) : spec.discard === "seafaring" ? otherInPlay(d, card, (id) => isKind(d, id, "Seafaring")) : [];
  const weight = (d: Draft, id: InstanceId): number => (spec.discard === "person" ? personWeight(d.catalog, d.s, id) : 1);
  const enough = (d: Draft, card: InstanceId): boolean => pool(d, card).reduce((n, id) => n + weight(d, id), 0) >= need(d, card);
  const boostable = (d: Draft, card: InstanceId, without: InstanceId[]): InstanceId[] =>
    personsInPlay(d, card).filter((id) => !without.includes(id) && boostOptions(d, id).length > 0 && canAddResourceSticker(d.catalog, d.s, id));
  const what = spec.discard === "person" ? "personne" : "carte maritime";
  return () => ({
    params: (d, card) => {
      const b = next(d, card);
      return b && canPayD(d, b.cost ?? []) && enough(d, card) ? [NO_PARAMS] : [];
    },
    costOf: (d, card) => next(d, card)?.cost ?? [],
    ask: (d, card, a) => {
      let k = 0;
      const n = need(d, card);
      if (n > 0) {
        if (a.length === k) {
          const label = `${n} ${what}${n > 1 ? "s" : ""} à défausser`;
          return spec.discard === "person" ? askPersons(label, pool(d, card), n, (id) => weight(d, id)) : askCards(label, pool(d, card), n);
        }
        k += 1;
      }
      if (spec.boost) {
        const options = boostable(d, card, cardsOf(a[0]));
        if (options.length === 0) return null;
        if (a.length === k) return askCards("Personne dont la production augmente de 1", options, 1);
        const target = cardsOf(a[k])[0];
        const rs = target ? boostOptions(d, target) : [];
        if (rs.length > 1 && a.length === k + 1) return askResources("Quelle ressource ?", rs, 1);
      }
      return null;
    },
    apply: (d, card, p) => {
      const b = next(d, card);
      if (!b) return;
      const a = p.answers ?? [];
      payD(d, b.cost ?? []);
      let k = 0;
      if (need(d, card) > 0) discardCards(d, cardsOf(a[k++]));
      markBox(d, card, b.stage, b.id);
      if (spec.goods) effectGain(d, Array.from({ length: spec.goods }, () => "tradeGood"));
      const target = spec.boost ? cardsOf(a[k])[0] : undefined;
      const r = target ? (resourcesOf(a[k + 1])[0] ?? boostOptions(d, target)[0]) : undefined;
      if (target && r) addResourceStickerOf(d, target, r);
    },
  });
}

// --- Fourrures : stickers sur une personne en jeu ---

function furSticker(n: string, arrow: "rotate" | "flip" | null): () => EffectImpl {
  const targets = (d: Draft, self: InstanceId) =>
    personsInPlay(d, self).filter((id) => STICKER_DEF[n]?.resource === undefined || canAddResourceSticker(d.catalog, d.s, id));
  return () =>
    effect({
      usable: (d, card) => targets(d, card).length > 0,
      ask: steps((d, card) => askCards(`Personne qui reçoit le ${labelFor(n)}`, targets(d, card), 1)),
      run: (d, card, a) => {
        for (const id of cardsOf(a[0])) placeSticker(d, id, n);
        if (arrow) turnCard(d, card, arrow);
      },
    });
}

// --- Turmeric : utiliser l'effet {activated} ou {time} d'une personne en jeu ---

type Borrowed = { effect: string; type: EffectType; text: string; oneTime: boolean; stage: StageId; impl: EffectImpl };

/** Effets {activated} et {time} d'une personne qu'on peut utiliser maintenant. */
function borrowable(d: Draft, person: InstanceId): Borrowed[] {
  return usableEffects(d.catalog, d.s, person).flatMap(({ stage, effect: e, impl }): Borrowed[] => {
    if (e.type !== "activated" && e.type !== "time") return [];
    if (e.type === "time" && timeBlockedFor(d.catalog, d.s, person)) return [];
    if (impl.params(d, person).length === 0) return [];
    return [{ effect: e.id, type: e.type, text: e.text, oneTime: e.oneTime ?? false, stage: stage.id, impl }];
  });
}

/** Paramètres de l'effet emprunté : ses questions (`ask`), sinon un choix parmi ses paramètres s'il y en a plusieurs. */
const asksInner = (d: Draft, person: InstanceId, b: Borrowed): boolean => {
  const ps = b.impl.params(d, person);
  return b.impl.ask !== undefined && ps.length >= 1 && ps.every((p) => p.targets.length === 0 && p.option === null);
};

function paramLabel(d: Draft, person: InstanceId, b: Borrowed, p: EffectParams): string {
  const labels = b.impl.labels?.(d, person);
  if (p.option !== null && labels?.[p.option]) return labels[p.option] ?? "";
  const gains = b.impl.gains?.(d);
  if (p.option !== null && gains?.[p.option]) return iconText(gains[p.option] ?? []);
  return p.targets.map((id) => cardName(d.catalog, d.s, id)).join(", ") || b.text;
}

function turmeric(): EffectImpl {
  const people = (d: Draft, self: InstanceId) => personsInPlay(d, self).filter((id) => borrowable(d, id).length > 0);
  /** Personne, effet emprunté, et rang de la première réponse qui lui revient. */
  const chosen = (d: Draft, a: Answer[]): { person: InstanceId; b: Borrowed; from: number } | null => {
    const person = cardsOf(a[0])[0];
    if (!person) return null;
    const list = borrowable(d, person);
    if (list.length === 1) return list[0] ? { person, b: list[0], from: 1 } : null;
    const b = list[optionOf(a[1])];
    return b ? { person, b, from: 2 } : null;
  };
  return effect({
    usable: (d, card) => hasFreeBox(d, card) && people(d, card).length > 0,
    ask: (d, card, a) => {
      if (a.length === 0) return askCards("Personne dont tu utilises l'effet", people(d, card), 1);
      const person = cardsOf(a[0])[0];
      if (!person) return null;
      const list = borrowable(d, person);
      if (list.length > 1 && a.length === 1) return askOption("Quel effet ?", list.map((x) => x.text));
      const c = chosen(d, a);
      if (!c) return null;
      if (asksInner(d, c.person, c.b)) return c.b.impl.ask?.(d, c.person, a.slice(c.from)) ?? null;
      const ps = c.b.impl.params(d, c.person);
      if (ps.length > 1 && a.length === c.from) return askOption("Comment ?", ps.map((p) => paramLabel(d, c.person, c.b, p)));
      return null;
    },
    run: (d, card, a) => {
      const c = chosen(d, a);
      if (!c) return;
      const stage = activeStage(d.catalog, d.s, card)?.id;
      markNext(d, card);
      log(d.s, `${cardName(d.catalog, d.s, card)} : effet de ${cardName(d.catalog, d.s, c.person)} utilisé (${c.b.text})`);
      // Décision du 2026-10-05 : la personne reste en jeu ; un effet {time} finit quand même le tour.
      if (c.b.type === "time") endTurn(d);
      if (c.b.oneTime) instance(d.s, c.person).crossedOutEffects.push(`${c.b.stage}/${c.b.effect}`);
      const ps = c.b.impl.params(d, c.person);
      const p: EffectParams = asksInner(d, c.person, c.b)
        ? { targets: [], option: null, answers: a.slice(c.from) }
        : (ps.length > 1 ? ps[optionOf(a[c.from])] : ps[0]) ?? NO_PARAMS;
      c.b.impl.apply(d, c.person, p);
      if (stage !== undefined && trackComplete(d, card, stage)) resetCard(d, card);
    },
  });
}

// --- Effets utilisés comme action, par texte exact ---

export const MERCHANTS_EFFECTS: Record<string, () => EffectImpl> = {
  // Épices.
  "Discard 1 person to rotate this card to any orientation.": () => {
    const others = (d: Draft, card: InstanceId) => orientations(d, card).filter((x) => !sameOrientation(x.o, instance(d.s, card).orientation));
    return effect({
      usable: (d, card) => persons(d, card).length > 0,
      ask: steps(
        (d, card) => askCards("Personne à défausser", persons(d, card), 1),
        (d, card) => {
          const t = template(d.catalog, instance(d.s, card).templateId);
          return askOption("Quelle orientation ?", others(d, card).map((x) => t.stages[String(x.stage) as "1"]?.name ?? `Stage ${x.stage}`));
        },
      ),
      run: (d, card, a) => {
        const o = others(d, card)[optionOf(a[1])];
        discardCards(d, cardsOf(a[0]));
        if (o) setOrientation(d, card, o.o);
      },
    });
  },
  "Mark {mark} to gain {coin}{coin}{coin}. When complete, reset.": () =>
    effect({
      usable: hasFreeBox,
      run: (d, card) => {
        const stage = activeStage(d.catalog, d.s, card)?.id;
        markNext(d, card);
        effectGain(d, ["coin", "coin", "coin"]);
        if (stage !== undefined && trackComplete(d, card, stage)) resetCard(d, card);
      },
    }),
  "Mark {mark} to gain 1 person's production as resources. When complete, reset.": () => {
    const producing = (d: Draft, self: InstanceId) => personsInPlay(d, self).filter((id) => hasProduction(d, id));
    return effect({
      usable: (d, card) => hasFreeBox(d, card) && producing(d, card).length > 0,
      ask: (d, card, a) => {
        if (a.length === 0) return askCards("Personne dont tu gagnes la production", producing(d, card), 1);
        const target = cardsOf(a[0])[0];
        return target ? slashQuestion(d, target, a, 1) : null;
      },
      run: (d, card, a) => {
        const target = cardsOf(a[0])[0];
        if (target) gainProductionOf(d, target, a, 1);
        markThenReset(d, card);
      },
    });
  },
  "Mark {mark} to use the {activated} or {time} effect of 1 person in play. When complete, reset.": turmeric,
  // Fourrures.
  "Add sticker 1 to a person in play. Then {rotate}.": furSticker("1", "rotate"),
  "Add sticker 18 as production to a person in play, then {flip}.": furSticker("18", "flip"),
  "Add sticker 7 to a person in play, then {rotate}.": furSticker("7", "rotate"),
  "Add sticker 17 to a person in play.": furSticker("17", null),
  // Pistes.
  "Discard 1 person AND spend the {coin} below to improve your weaving: mark {mark} from left to right.": track({ discard: "person", goods: 0, boost: false }),
  "Discard the number of seafaring cards printed for each spot to develop your fishing fleet: mark {mark} from left to right.": track({ discard: "seafaring", goods: 0, boost: false }),
  "Discard the number of persons AND spend the {coin} printed for each spot below to mark {mark} from left to right AND gain 5{tradeGood}.": track({ discard: "person", goods: 5, boost: false }),
  "Discard 1 person AND spend the {wood} printed for each spot to make some baskets: mark {mark} from left to right and gain 5{tradeGood}.": track({ discard: "person", goods: 5, boost: false }),
  "Spend the resources printed for each spot to improve your shoemaking: mark {mark} from left to right and boost the production of 1 person in play.": track({ discard: null, goods: 0, boost: true }),
  // Grain, Grapes, Wine.
  "Mark {mark} to add sticker 1 as production to a land in play.": () => {
    const lands = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isKind(d, id, "Land") && canAddResourceSticker(d.catalog, d.s, id));
    return effect({
      usable: (d, card) => hasFreeBox(d, card) && lands(d, card).length > 0,
      ask: steps((d, card) => askCards(`Terre qui reçoit le ${labelFor("1")}`, lands(d, card), 1)),
      run: (d, card, a) => {
        markNext(d, card);
        for (const id of cardsOf(a[0])) placeSticker(d, id, "1");
      },
    });
  },
  "Mark {mark} to add sticker 6 to a land in play, replacing another production.": () => {
    /** Groupes de production imprimés qu'on peut encore rayer. */
    const crossable = (d: Draft, id: InstanceId) => {
      const stage = activeStage(d.catalog, d.s, id);
      if (!stage) return [];
      const c = instance(d.s, id);
      return stage.production.filter((g) => c.crossedOutProduction.filter((k) => k.startsWith(`${stage.id}/${g.id}/`)).length < Math.max(...g.options.map((o) => o.length)));
    };
    const lands = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isKind(d, id, "Land") && crossable(d, id).length > 0);
    return effect({
      usable: (d, card) => hasFreeBox(d, card) && lands(d, card).length > 0,
      ask: steps(
        (d, card) => askCards(`Terre qui reçoit le ${labelFor("6")}`, lands(d, card), 1),
        (d, _card, a) => {
          const land = cardsOf(a[0])[0];
          const groups = land ? crossable(d, land) : [];
          return groups.length > 1 ? askOption("Production remplacée", groups.map((g) => g.options.map(iconText).join("/"))) : null;
        },
      ),
      run: (d, card, a) => {
        const land = cardsOf(a[0])[0];
        markNext(d, card);
        if (!land) return;
        const groups = crossable(d, land);
        const g = groups.length > 1 ? groups[optionOf(a[1])] : groups[0];
        if (g && crossOutProduction(d.catalog, d.s, land, g.id)) log(d.s, `${cardName(d.catalog, d.s, land)} : 1 production rayée`);
        placeSticker(d, land, "6");
      },
    });
  },
  "Spend {tradeGood}{tradeGood} and mark {mark} to add sticker 6 as production here.": () =>
    effect({
      cost: ["tradeGood", "tradeGood"],
      usable: hasFreeBox,
      run: (d, card) => {
        markNext(d, card);
        addResourceStickerOf(d, card, "tradeGood");
      },
    }),
  // Beer, Mead, Viking Warrior.
  "Mark {mark} to play up to 2 persons from discard pile. When complete, {flip}.": () => {
    const options = (d: Draft, self: InstanceId) => d.s.zones.discard.filter((id) => id !== self && isPerson(d, id));
    return effect({
      usable: hasFreeBox,
      ask: steps((d, card) => {
        const opts = options(d, card);
        return opts.length ? askCards("Jusqu'à 2 personnes à jouer depuis la défausse", opts, 1, Math.min(2, opts.length)) : null;
      }),
      run: (d, card, a) => {
        const stage = activeStage(d.catalog, d.s, card)?.id;
        markNext(d, card);
        const ids = cardsOf(a[0]);
        for (const id of ids) log(d.s, `${cardName(d.catalog, d.s, id)} est jouée depuis la défausse`);
        playCards(d, ids);
        if (stage !== undefined && trackComplete(d, card, stage)) turnCard(d, card, "flip");
      },
    });
  },
  "Gain each person's production as resources, then {flip}.": () => {
    const producing = (d: Draft, self: InstanceId) => personsInPlay(d, self).filter((id) => hasProduction(d, id));
    /** Questions « / » de toutes les personnes, dans l'ordre. */
    const slashes = (d: Draft, self: InstanceId) =>
      producing(d, self).flatMap((id) => productionGroups(d.catalog, d.s, id).filter((g) => g.options.length > 1).map((g) => ({ id, g })));
    return effect({
      ask: (d, card, a) => {
        const q = slashes(d, card)[a.length];
        return q ? askOption(`${cardName(d.catalog, d.s, q.id)} : quelle production ?`, q.g.options.map(iconText)) : null;
      },
      run: (d, card, a) => {
        let k = 0;
        for (const id of producing(d, card)) k = gainProductionOf(d, id, a, k);
        turnCard(d, card, "flip");
      },
    });
  },
  "Spend {coin}{coin} to mark any {mark}. When complete, {flip}.": () => {
    const label = (b: Checkbox): string => (b.gain?.length ? `+${iconText(b.gain)}` : "Case");
    return effect({
      cost: ["coin", "coin"],
      usable: hasFreeBox,
      ask: steps((d, card) => askBox("Quelle case cocher ?", unmarkedBoxes(d, card).map(label), unmarkedBoxes(d, card).map((b) => b.id))),
      run: (d, card, a) => {
        const free = unmarkedBoxes(d, card);
        const touched = boxOf(a[0]);
        const b = touched !== null ? free.find((x) => x.id === touched) : free[optionOf(a[0])];
        if (!b) return;
        markBox(d, card, b.stage, b.id);
        if (trackComplete(d, card, b.stage)) turnCard(d, card, "flip");
      },
    });
  },
  // Brigands et Brigand Boss.
  "Destroy 2 friendly cards in play with production to {flip}.": () => {
    const targets = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => friendly(d, id) && hasProduction(d, id) && canBeDestroyed(d, id));
    return effect({
      usable: (d, card) => targets(d, card).length >= 2,
      ask: steps((d, card) => askCards("2 cartes amies avec production à détruire", targets(d, card), 2)),
      run: (d, card, a) => {
        destroyCards(d, cardsOf(a[0]));
        turnCard(d, card, "flip");
      },
    });
  },
  "Destroy 1 card in play with 3 or more production to defeat ({destroy}).": () => {
    const targets = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => productionCount(d.catalog, d.s, id) >= 3 && canBeDestroyed(d, id));
    return effect({
      usable: (d, card) => targets(d, card).length > 0,
      ask: steps((d, card) => askCards("Carte avec 3 productions ou plus à détruire", targets(d, card), 1)),
      run: (d, card, a) => {
        destroyCards(d, cardsOf(a[0]));
        defeat(d, card, []);
      },
    });
  },
};

/** Effets reconnus par motif : « Choose one: … », « Spend 8{sword} to defeat ({flip}). », « Spend {coin}{coin} to {rotate}. » */
export function merchantsPattern(text: string): (() => EffectImpl) | undefined {
  const choose = chooseOneDiscover(text);
  if (choose) return choose;
  const serials = (m: RegExpExecArray, i: number): number[] => (m[i] ?? "").split("/").map((n) => Number(n.trim()));
  // Camel Herd : « Reset this to discover Pair of Camels (24 / 25). » (chaque copie cite les autres).
  const copy = /^Reset this to discover [^(]+ \(([\d /]+)\)\.$/.exec(text);
  if (copy) {
    const list = serials(copy, 1);
    return () => effect({ run: (d, card) => (resetCard(d, card), discoverCopy(d, list)) });
  }
  // Sheep Flock : « Reset this and discard 1 person to discover Pair of Sheep (22 / 23). »
  const sheep = /^Reset this and discard 1 person to discover [^(]+ \(([\d /]+)\)\.$/.exec(text);
  if (sheep) {
    const list = serials(sheep, 1);
    return () =>
      effect({
        usable: (d, card) => persons(d, card).length > 0,
        ask: steps((d, card) => askCards("Personne à défausser", persons(d, card), 1)),
        run: (d, card, a) => {
          discardCards(d, cardsOf(a[0]));
          resetCard(d, card);
          discoverCopy(d, list);
        },
      });
  }
  // Chicken Farm : « Reset to discover Chicken (20 / 21) or to gain 8{tradeGood}. »
  const farm = /^Reset to discover ([^(]+) \(([\d /]+)\) or to gain ((?:\d*\{\w+\})+)\.$/.exec(text);
  if (farm) {
    const list = serials(farm, 2);
    const goods = expandIcons(farm[3] ?? "");
    const name = `${(farm[1] ?? "").trim()} (${farm[2] ?? ""})`;
    return () => ({
      params: (d) => [...(list.some((n) => boxCardsBySerial(d, [n]).length > 0) ? [{ targets: [], option: 0 }] : []), { targets: [], option: 1 }],
      labels: () => [`Découvrir ${name}`, `Gagner ${iconText(goods)}`],
      apply: (d, card, p) => {
        resetCard(d, card);
        if (p.option === 0) discoverCopy(d, list);
        else effectGain(d, goods);
      },
    });
  }
  const defeatBy = /^Spend ((?:\d*\{\w+\})+) to defeat \(\{(?:destroy|flip)\}\)\.$/.exec(text);
  if (defeatBy && /\d/.test(defeatBy[1] ?? "")) {
    const cost = expandIcons(defeatBy[1] ?? "");
    return () => effect({ cost, run: (d, card) => defeat(d, card, []) });
  }
  const turn = /^Spend ((?:\{\w+\})+) to \{(rotate|flip)\}\.$/.exec(text);
  if (turn) {
    const cost = expandIcons(turn[1] ?? "");
    const arrow = turn[2] === "flip" ? "flip" : "rotate";
    return () => effect({ cost, run: (d, card) => turnCard(d, card, arrow) });
  }
  return undefined;
}

/** Effets ajoutés par un sticker (sticker 18 : « {activated} Place this at the bottom of your deck. »). */
export const STICKER_EFFECTS: Record<string, () => EffectImpl> = {
  "18": () => effect({ run: (d, card) => putOnDeck(d, card, "bottom") }),
};
export const stickerEffectKey = (sticker: string): string => `sticker:${sticker}`;

// --- Effets déclenchés ---

/** La carte guide suivante (Merchants 10) devient la carte de l'extension en cours. */
function nextGuide(d: Draft, serial: number): void {
  const id = boxCardsBySerial(d, [serial])[0];
  const camp = campaignOf(d.s);
  if (id && camp.grand !== undefined) camp.current = id;
  discoverSerials(d, [serial]);
}

export const MERCHANTS_TRIGGERS: Record<string, () => TriggerImpl> = {
  // Merchants 01 et 10 : ce sont eux qui mènent les 4 manches de l'extension.
  "End of Round: discover Brigands (19), then {flip}.": () =>
    trigger({ timing: "endRound", optional: false, run: (d, card) => (discoverSerials(d, [19]), turnCard(d, card, "flip")) }),
  "End of Round: destroy this and discover Merchants (10).": () =>
    trigger({ timing: "endRound", optional: false, run: (d, card) => (destroyCards(d, [card]), nextGuide(d, 10)) }),
  "End of Round: {flip}.": () => trigger({ timing: "endRound", optional: false, run: (d, card) => turnCard(d, card, "flip") }),
  "End of Round: destroy this. The expansion is over.": () =>
    trigger({
      timing: "endRound",
      optional: false,
      run: (d, card) => {
        destroyCards(d, [card]);
        log(d.s, "L'extension est terminée");
      },
    }),
  // Hangover : chaque personne jouée (avec elle ou après) est défaussée et coche une case.
  "When a person is played, discard it and mark {mark}. When complete, {destroy}.": () => {
    const arrived = (d: Draft, card: InstanceId, ids: readonly InstanceId[]) => ids.filter((id) => id !== card && d.s.zones.play.includes(id) && isPerson(d, id));
    return trigger({
      timing: ["played", "otherPlayed"],
      optional: false,
      when: (d, card, ctx) => d.s.zones.play.includes(card) && arrived(d, card, ctx.cards ?? []).length > 0,
      run: (d, card, _a, ctx) => {
        for (const id of arrived(d, card, ctx.cards ?? [])) {
          if (!d.s.zones.play.includes(card)) break;
          discardCards(d, [id]);
          const stage = activeStage(d.catalog, d.s, card)?.id;
          markNext(d, card);
          if (stage !== undefined && trackComplete(d, card, stage)) {
            if (canBeDestroyed(d, card)) destroyCards(d, [card]);
            break;
          }
        }
      },
    });
  },
  // Too Much Mead.
  "When played, lose the next 3 resources you gain this turn.": () =>
    trigger({
      timing: "played",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card),
      run: (d) => {
        d.s.loseNext = (d.s.loseNext ?? 0) + 3;
        log(d.s, "Les 3 prochaines ressources gagnées ce tour sont perdues");
      },
    }),
};
