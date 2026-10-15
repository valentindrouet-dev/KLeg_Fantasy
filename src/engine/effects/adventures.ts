import type { ResourceId } from "../../data/schema";
import { askCards, askOption, askPersons, askResources, boxOf, cardsOf, optionOf, resourcesOf } from "../choice";
import { discardFromDeck, discoverSerials, endTurn, playCard } from "../flow";
import {
  addResourceStickerOf,
  blockCards,
  canBeDestroyed,
  canPayD,
  destroyCards,
  discardCards,
  doneThisTurn,
  effectGain,
  friendly,
  isKind,
  isPerson,
  kingdom,
  markBox,
  otherInPlay,
  payD,
  setDoneThisTurn,
  stageName,
  trackComplete,
  turnCard,
  unmarkedBoxes,
} from "../ops";
import { canAddResourceSticker, crossableIcons, crossOutIcon, crossOutProduction, productionCount, productionGroups } from "../production";
import { shuffle } from "../rng";
import { activeStage, cardName, countPersons, discard, instance, log, moveTo, personWeight, template, zoneOf } from "../state";
import type { Answer, ChoiceRequest, Draft, EffectImpl, EffectParams, InstanceId, TriggerImpl } from "../types";
import { NO_PARAMS } from "./registry";
import { defeat, effect, freeMark, icon, markNext, persons, placeSticker, steps, STICKER_DEF, trigger } from "./cards";
import { asksInner, borrowable, gainProductionOf, paramLabel, slashQuestion } from "./merchants";
import { freeIn, markNextIn } from "./ridding";
import { upgradeCard } from "../actions";

// Effets des cartes de l'extension Feudal Kingdom Adventures (cartes 00 à 28), reconnus à leur texte imprimé exact,
// comme ceux de Feudal Kingdom (effects/cards.ts). Lancement, purge 10, 3 manches de 2 découvertes : campaign.ts.
// Ailleurs : protections (ops.destroyCards, campaign.ts pour la purge), tourment (flow.ts), Wheel of Fortune
// (production.ts), Friendship (flow.staysInPlay), Fiddler's Green (state.destroy). Décisions : docs/RULES_DECISIONS.md.
// Rien ici ne doit appeler cards.ts au chargement du module (import circulaire) : seulement dans les fabriques.

const iconText = (rs: readonly ResourceId[]): string => rs.map(icon).join("");
const hasFreeBox = (d: Draft, card: InstanceId): boolean => unmarkedBoxes(d, card).length > 0;
const isSeafaring = (d: Draft, id: InstanceId): boolean => isKind(d, id, "Seafaring");
const isMagical = (d: Draft, id: InstanceId): boolean => isKind(d, id, "Magical");
/** Merlin (le Sage ou le Puissant) : la carte 04 d'Adventures. */
const isMerlin = (d: Draft, id: InstanceId): boolean => /^Merlin the /.test(stageName(d, id));
const merlinInPlay = (d: Draft, self: InstanceId): InstanceId | undefined => otherInPlay(d, self, (id) => isMerlin(d, id))[0];
const friendlyOthers = (d: Draft, self: InstanceId): InstanceId[] => otherInPlay(d, self, (id) => friendly(d, id));

/** Coche la case suivante ; piste complète : la carte est tournée (ou retournée). */
function markThen(d: Draft, card: InstanceId, arrow: "rotate" | "flip" | null, n = 1): void {
  const stage = activeStage(d.catalog, d.s, card)?.id;
  for (let i = 0; i < n; i++) {
    if (activeStage(d.catalog, d.s, card)?.id !== stage || !markNext(d, card)) break;
  }
  if (arrow && stage !== undefined && activeStage(d.catalog, d.s, card)?.id === stage && trackComplete(d, card, stage)) turnCard(d, card, arrow);
}

/** Cartes bloquées par `blocker` remises dans la défausse (la carte qui les bloquait a changé ou disparu). */
function releaseBlocked(d: Draft, blocker: InstanceId): void {
  const held = d.s.blocks?.[blocker] ?? [];
  if (d.s.blocks) delete d.s.blocks[blocker];
  for (const id of held) {
    discard(d, id);
    log(d.s, `${cardName(d.catalog, d.s, id)} n'est plus bloquée`);
  }
}

function reshuffleDeck(d: Draft): void {
  const r = shuffle(d.s.zones.deck, d.s.rng);
  d.s.rng = r.state;
  d.s.zones.deck = r.items;
  d.s.revealCount += 1;
  log(d.s, "Le deck est remélangé");
}

/** Personnes ou cartes maritimes en jeu (Lorelei, Nessie). */
const personsOrSeafaring = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isPerson(d, id) || isSeafaring(d, id));

// --- Stickers de Merlin (86a à 89b) : cadres d'effet qui remplacent un effet imprimé ---

const MERLIN_STICKERS: Record<string, string[]> = { "86": ["86a", "86b"], "87": ["87a", "87b"], "88": ["88a", "88b"], "89": ["89a", "89b"] };

function replaceFrame(pair: string): () => EffectImpl {
  const choices = MERLIN_STICKERS[pair] ?? [];
  const text = `Add sticker ${choices.join(" / ")} to replace this effect frame.`;
  const label = (n: string) => `Sticker ${n} : ${STICKER_DEF[n]?.effect ?? ""}`;
  return () =>
    effect({
      ask: steps(() => askOption("Quel cadre d'effet ?", choices.map(label))),
      run: (d, card, a) => {
        const n = choices[optionOf(a[0])] ?? choices[0] ?? "";
        const stage = activeStage(d.catalog, d.s, card);
        const replaced = stage?.effects.find((e) => e.text === text);
        if (!stage || !replaced) return;
        const def = STICKER_DEF[n];
        if (!def) return;
        instance(d.s, card).stickers.push({ sticker: n, stage: stage.id, ...def, replaces: replaced.id });
        instance(d.s, card).crossedOutEffects.push(`${stage.id}/${replaced.id}`);
        log(d.s, `${cardName(d.catalog, d.s, card)} : sticker ${n} (${def.effect ?? ""})`);
      },
    });
}

/** Effets des stickers d'Adventures (clé : stickerEffectKey). 86b (Friendship) : flow.staysInPlay ; 88b : non automatisé. */
export const ADVENTURE_STICKER_EFFECTS: Record<string, () => EffectImpl> = {
  // Authority (passif) : à volonté.
  "86a": () =>
    effect({
      usable: (d, card) => persons(d, card).length > 0,
      ask: steps(
        (d, card) => askCards("Personne à défausser", persons(d, card), 1),
        (d) => askResources("Quelle ressource ?", d.catalog.resources, 1),
      ),
      run: (d, _card, a) => {
        discardCards(d, cardsOf(a[0]));
        effectGain(d, resourcesOf(a[1]));
      },
    }),
  "87a": () => effect({ run: (d) => effectGain(d, ["coin", "coin", "coin", "coin", "coin", "coin"]) }),
  "87b": () => {
    const options: ResourceId[][] = [
      ["metal", "metal", "metal"],
      ["tradeGood", "tradeGood", "tradeGood"],
    ];
    return { params: () => options.map((_, i) => ({ targets: [], option: i })), gains: () => options, apply: (d, _card, p) => effectGain(d, options[p.option ?? 0] ?? []) };
  },
  "88a": () => effect({ run: (d) => effectGain(d, ["sword", "sword", "sword", "sword"]) }),
  "89a": () => {
    const options = (d: Draft, self: InstanceId) => d.s.zones.discard.filter((id) => id !== self && isMagical(d, id));
    return effect({
      usable: (d, card) => options(d, card).length > 0,
      ask: steps((d, card) => askCards("Carte magique à jouer depuis la défausse", options(d, card), 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => playCard(d, id)),
    });
  },
  "89b": () => {
    const count = (d: Draft) => d.s.zones.play.filter((id) => isMagical(d, id)).length;
    return effect({
      usable: (d) => count(d) > 0,
      ask: steps((d) => askResources(`Choisis ${count(d)} ressource(s)`, d.catalog.resources, count(d))),
      run: (d, _card, a) => effectGain(d, resourcesOf(a[0])),
    });
  },
  // Sticker 54 : « Play Cerapter from anywhere. »
  "54": () => {
    const cerapter = (d: Draft) =>
      Object.values(d.s.cards)
        .map((c) => c.instanceId)
        .find((id) => template(d.catalog, instance(d.s, id).templateId).stages["4"]?.name === "Cerapter" && ["deck", "discard", "permanent", "blocked"].includes(zoneOf(d.s, id)));
    return effect({
      usable: (d) => cerapter(d) !== undefined,
      run: (d) => {
        const id = cerapter(d);
        if (!id) return;
        log(d.s, `${cardName(d.catalog, d.s, id)} est jouée (sticker 54)`);
        for (const [blocker, held] of Object.entries(d.s.blocks ?? {})) if (held.includes(id) && d.s.blocks) d.s.blocks[blocker] = held.filter((x) => x !== id);
        playCard(d, id);
      },
    });
  },
};

// --- Effets utilisés comme action, par texte exact ---

/** « Discard 2 persons / seafaring cards to mark 1 {mark}. … » et variantes : défausser des cartes, cocher. */
function discardToMark(o: { label: string; pick: (d: Draft, self: InstanceId) => InstanceId[]; n: number; weighted?: boolean; after: (d: Draft, card: InstanceId) => void }): () => EffectImpl {
  const enough = (d: Draft, card: InstanceId) => (o.weighted ? countPersons(d.catalog, d.s, o.pick(d, card)) : o.pick(d, card).length) >= o.n;
  return () =>
    effect({
      usable: (d, card) => hasFreeBox(d, card) && enough(d, card),
      ask: steps((d, card) => (o.weighted ? askPersons(o.label, o.pick(d, card), o.n, (id) => personWeight(d.catalog, d.s, id)) : askCards(o.label, o.pick(d, card), o.n))),
      run: (d, card, a) => {
        discardCards(d, cardsOf(a[0]));
        o.after(d, card);
      },
    });
}

/** Trading With Pixies : 7 ressources (sauf {sword}) par case, prises parmi les plus nombreuses (décision du 2026-10-15). */
function pixiesPay(d: Draft): ResourceId[] {
  const pool = { ...d.s.resources };
  const out: ResourceId[] = [];
  for (let i = 0; i < 7; i++) {
    const r = d.catalog.resources.filter((x) => x !== "sword" && (pool[x] ?? 0) > 0).sort((a, b) => (pool[b] ?? 0) - (pool[a] ?? 0))[0];
    if (!r) break;
    out.push(r);
    pool[r] = (pool[r] ?? 0) - 1;
  }
  return out;
}

/** Une carte bénie (sticker 38) dont on emprunte la production ou un effet {activated} (The White Cowl). */
function whiteCowl(): EffectImpl {
  const blessed = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isKind(d, id, "Blessed"));
  const borrowed = (d: Draft, id: InstanceId) => borrowable(d, id).filter((b) => b.type === "activated");
  /** Choix pour une carte : sa production (si elle en a), puis ses effets {activated} utilisables. */
  const ways = (d: Draft, id: InstanceId) => [...(productionGroups(d.catalog, d.s, id).length ? ["Gagner sa production"] : []), ...borrowed(d, id).map((b) => b.text)];
  return effect({
    usable: (d, card) => blessed(d, card).some((id) => ways(d, id).length > 0),
    ask: (d, card, a) => {
      if (a.length === 0) return askCards("Carte bénie", blessed(d, card).filter((id) => ways(d, id).length > 0), 1);
      const target = cardsOf(a[0])[0];
      if (!target) return null;
      const list = ways(d, target);
      if (a.length === 1 && list.length > 1) return askOption("Que faire ?", list);
      const k = list.length > 1 ? optionOf(a[1]) : 0;
      const from = list.length > 1 ? 2 : 1;
      const prod = productionGroups(d.catalog, d.s, target).length > 0;
      if (prod && k === 0) return slashQuestion(d, target, a, from);
      const b = borrowed(d, target)[prod ? k - 1 : k];
      if (!b) return null;
      if (asksInner(d, target, b)) return b.impl.ask?.(d, target, a.slice(from)) ?? null;
      const ps = b.impl.params(d, target);
      return ps.length > 1 && a.length === from ? askOption("Comment ?", ps.map((p) => paramLabel(d, target, b, p))) : null;
    },
    run: (d, _card, a) => {
      const target = cardsOf(a[0])[0];
      if (!target) return;
      const list = ways(d, target);
      const k = list.length > 1 ? optionOf(a[1]) : 0;
      const from = list.length > 1 ? 2 : 1;
      const prod = productionGroups(d.catalog, d.s, target).length > 0;
      if (prod && k === 0) {
        gainProductionOf(d, target, a, from);
        return;
      }
      const b = borrowed(d, target)[prod ? k - 1 : k];
      if (!b) return;
      log(d.s, `Effet de ${cardName(d.catalog, d.s, target)} utilisé (${b.text})`);
      const ps = b.impl.params(d, target);
      const p: EffectParams = asksInner(d, target, b) ? { targets: [], option: null, answers: a.slice(from) } : ((ps.length > 1 ? ps[optionOf(a[from])] : ps[0]) ?? NO_PARAMS);
      b.impl.apply(d, target, p);
    },
  });
}

export const ADVENTURE_EFFECTS: Record<string, () => EffectImpl> = {
  // Last Voyage.
  "Discard 1 seafaring card to mark 1 {mark}. When complete, {rotate}.": discardToMark({
    label: "Carte maritime à défausser",
    pick: (d, self) => otherInPlay(d, self, (id) => isSeafaring(d, id)),
    n: 1,
    after: (d, card) => markThen(d, card, "rotate"),
  }),
  // Merlin the Wise.
  "Make 1 building or item in play magical (sticker 57).": () => {
    const targets = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => (isKind(d, id, "Building") || isKind(d, id, "Item")) && !isMagical(d, id));
    return effect({
      usable: (d, card) => targets(d, card).length > 0,
      ask: steps((d, card) => askCards("Bâtiment ou objet rendu magique (sticker 57)", targets(d, card), 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => placeSticker(d, id, "57")),
    });
  },
  "Add sticker 86a / 86b to replace this effect frame.": replaceFrame("86"),
  "Add sticker 87a / 87b to replace this effect frame.": replaceFrame("87"),
  "Add sticker 88a / 88b to replace this effect frame.": replaceFrame("88"),
  "Add sticker 89a / 89b to replace this effect frame.": replaceFrame("89"),
  // Invisibility Cloak.
  "Mark 1 {mark} below to discard all negative cards in play and in your deck, then reshuffle the deck.": () =>
    effect({
      usable: hasFreeBox,
      run: (d, card) => {
        markNext(d, card);
        const negatives = [...otherInPlay(d, card, (id) => !friendly(d, id)), ...d.s.zones.deck.filter((id) => !friendly(d, id))];
        discardCards(d, negatives);
        reshuffleDeck(d);
      },
    }),
  // Trading With Pixies (passif : à volonté).
  "Spend any number of resources, except {sword}, to mark 1 {mark} for every 7 resources spent. When complete, {flip}.": () =>
    effect({
      usable: (d, card) => hasFreeBox(d, card) && pixiesPay(d).length === 7,
      run: (d, card) => {
        const cost = pixiesPay(d);
        payD(d, cost);
        log(d.s, `${cardName(d.catalog, d.s, card)} : ${iconText(cost)} dépensées`);
        markThen(d, card, "flip");
      },
    }),
  // Fountain of Youth (passif).
  "Discard 2 persons and spend 3 resources of the same kind to mark 1 {mark}. When complete, {flip}.": () => {
    const kinds = (d: Draft) => d.catalog.resources.filter((r) => (d.s.resources[r] ?? 0) >= 3);
    return effect({
      usable: (d, card) => hasFreeBox(d, card) && countPersons(d.catalog, d.s, persons(d, card)) >= 2 && kinds(d).length > 0,
      ask: steps(
        (d, card) => askPersons("2 personnes à défausser", persons(d, card), 2, (id) => personWeight(d.catalog, d.s, id)),
        (d) => askOption("Quelles ressources dépenser ?", kinds(d).map((r) => iconText([r, r, r]))),
      ),
      run: (d, card, a) => {
        const r = kinds(d)[Math.max(0, optionOf(a[1]))];
        if (!r) return;
        discardCards(d, cardsOf(a[0]));
        payD(d, [r, r, r]);
        markThen(d, card, "flip");
      },
    });
  },
  // Jack-in-Irons : le combattre (passif) ou le piéger ({time}, au choix du bois ou de la pierre).
  "Spend {sword}{sword}{sword} to fight him (mark 1 red {mark}).": () =>
    effect({ cost: ["sword", "sword", "sword"], usable: (d, card) => freeIn(d, card, "red"), run: (d, card) => void markNextIn(d, card, "red") }),
  "Spend {wood}{wood}{wood} / {stone}{stone}{stone} to trap him (mark 1 green {mark}).": () => {
    const options: ResourceId[][] = [
      ["wood", "wood", "wood"],
      ["stone", "stone", "stone"],
    ];
    return {
      params: (d, card) => (freeIn(d, card, "green") ? options.flatMap((o, i) => (canPayD(d, o) ? [{ targets: [], option: i }] : [])) : []),
      costOf: (_d, _card, p) => options[p?.option ?? 0] ?? [],
      labels: () => options.map((o) => `Piéger : ${iconText(o)}`),
      apply: (d, card, p) => {
        payD(d, options[p.option ?? 0] ?? []);
        markNextIn(d, card, "green");
      },
    };
  },
  // Cerapter.
  "Tab this with (sticker 53) and add sticker 54 to 1 person in play.": () => {
    const tabbed = (d: Draft, card: InstanceId) => instance(d.s, card).stickers.some((st) => st.sticker === "53");
    return effect({
      usable: (d, card) => !tabbed(d, card) && persons(d, card).length > 0,
      ask: steps((d, card) => askCards("Personne qui reçoit le sticker 54", otherInPlay(d, card, (id) => isPerson(d, id)), 1)),
      run: (d, card, a) => {
        placeSticker(d, card, "53");
        for (const id of cardsOf(a[0])) placeSticker(d, id, "54");
      },
    });
  },
  // Lorelei (passif).
  "Discard any number of persons / seafaring cards to mark that many {mark}. When complete, {flip}.": () =>
    effect({
      usable: (d, card) => hasFreeBox(d, card) && personsOrSeafaring(d, card).length > 0,
      ask: steps((d, card) => askCards("Personnes ou cartes maritimes à défausser", personsOrSeafaring(d, card), 1, Math.min(personsOrSeafaring(d, card).length, unmarkedBoxes(d, card).length))),
      run: (d, card, a) => {
        const ids = cardsOf(a[0]);
        discardCards(d, ids);
        markThen(d, card, "flip", ids.length);
      },
    }),
  // Cave of 7 Sleepers ({destroy}).
  "Discard 2 persons to discover an Ancient (20) AND a ship (21).": () =>
    effect({
      usable: (d, card) => countPersons(d.catalog, d.s, persons(d, card)) >= 2,
      ask: steps((d, card) => askPersons("2 personnes à défausser", persons(d, card), 2, (id) => personWeight(d.catalog, d.s, id))),
      run: (d, _card, a) => {
        discardCards(d, cardsOf(a[0]));
        discoverSerials(d, [20, 21]);
      },
    }),
  // Stealing from Nessie : vaincre ({time}), ou détruire à tout moment (passif). Ses cartes bloquées sont libérées.
  "Discard 2 persons / seafaring cards to mark 1 {mark}. When complete, defeat ({flip}).": discardToMark({
    label: "2 personnes ou cartes maritimes à défausser",
    pick: personsOrSeafaring,
    n: 2,
    after: (d, card) => {
      const stage = activeStage(d.catalog, d.s, card)?.id;
      markNext(d, card);
      if (stage === undefined || !trackComplete(d, card, stage)) return;
      log(d.s, `${cardName(d.catalog, d.s, card)} est vaincue`);
      releaseBlocked(d, card);
      turnCard(d, card, "flip");
    },
  }),
  "You may destroy this at any time.": () =>
    effect({
      run: (d, card) => {
        releaseBlocked(d, card);
        destroyCards(d, [card]);
      },
    }),
  // Philosopher's Stone.
  "Destroy 1 person and mark {mark} to shuffle all cards from your discard pile into your deck.": () => {
    const targets = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isPerson(d, id) && canBeDestroyed(d, id));
    return effect({
      usable: (d, card) => hasFreeBox(d, card) && targets(d, card).length > 0,
      ask: steps((d, card) => askCards("Personne à détruire", targets(d, card), 1)),
      run: (d, card, a) => {
        destroyCards(d, cardsOf(a[0]));
        markNext(d, card);
        for (const id of d.s.zones.discard.filter((x) => x !== card)) moveTo(d.s, id, "deck");
        reshuffleDeck(d);
      },
    });
  },
  // Brazen Oracle.
  "Discard 1 person to choose 1: * Gain any 2 resources. * Upgrade that person for free (ending your turn).": () => {
    const upgrades = (d: Draft, id: InstanceId) => activeStage(d.catalog, d.s, id)?.upgrades ?? [];
    const target = (d: Draft, card: InstanceId) => (d.s.zones.play.length ? otherInPlay(d, card, (id) => isPerson(d, id)) : []);
    return effect({
      usable: (d, card) => target(d, card).length > 0,
      ask: (d, card, a) => {
        if (a.length === 0) return askCards("Personne à défausser", target(d, card), 1);
        const person = cardsOf(a[0])[0];
        const canUp = person ? upgrades(d, person).length > 0 : false;
        if (a.length === 1) return canUp ? askOption("Choisis 1", ["Gagner 2 ressources au choix", "L'améliorer gratuitement (fin du tour)"]) : askResources("Choisis 2 ressources", d.catalog.resources, 2);
        if (!canUp) return null;
        if (optionOf(a[1]) === 0) return a.length === 2 ? askResources("Choisis 2 ressources", d.catalog.resources, 2) : null;
        const ups = person ? upgrades(d, person) : [];
        return a.length === 2 && ups.length > 1 ? askOption("Quelle amélioration ?", ups.map((u) => template(d.catalog, instance(d.s, person ?? "").templateId).stages[String(u.toStage) as "1"]?.name ?? "?")) : null;
      },
      run: (d, _card, a) => {
        const person = cardsOf(a[0])[0];
        if (!person) return;
        const canUp = upgrades(d, person).length > 0;
        if (!canUp || optionOf(a[1]) === 0) {
          discardCards(d, [person]);
          effectGain(d, resourcesOf(canUp ? a[2] : a[1]));
          return;
        }
        const u = upgrades(d, person)[Math.max(0, optionOf(a[2]))] ?? upgrades(d, person)[0];
        if (!u) return;
        const before = cardName(d.catalog, d.s, person);
        upgradeCard(d, person, u);
        log(d.s, `Amélioration gratuite : ${before} → ${cardName(d.catalog, d.s, person)}, fin du tour`);
        endTurn(d);
      },
    });
  },
  // Search for Uther's Tomb (passif).
  "Discard 3 persons to mark 1 {mark}. When complete, {flip}.": discardToMark({ label: "3 personnes à défausser", pick: persons, n: 3, weighted: true, after: (d, card) => markThen(d, card, "flip") }),
  // The Green Armor : « At any time » (utilisé comme une action, sans défausser la carte permanente).
  "At any time, add 1 armor (sticker 55) to 1 person in play or discard pile.": () => {
    const used = (d: Draft) => Object.values(d.s.cards).some((c) => c.stickers.some((st) => st.sticker === "55"));
    const targets = (d: Draft) => [...d.s.zones.play, ...d.s.zones.discard].filter((id) => isPerson(d, id));
    return effect({
      usable: (d) => !used(d) && targets(d).length > 0,
      ask: steps((d) => askCards("Personne qui reçoit l'armure (sticker 55)", targets(d), 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => placeSticker(d, id, "55")),
    });
  },
  // Building the Bridge (passif) : payer la case suivante.
  "Spend the resources to mark 1 {mark}. When complete, {rotate}.": () => ({
    ...effect({
      usable: (d, card) => {
        const next = unmarkedBoxes(d, card)[0];
        return next !== undefined && canPayD(d, next.cost ?? []);
      },
      run: (d, card) => {
        const next = unmarkedBoxes(d, card)[0];
        if (!next) return;
        payD(d, next.cost ?? []);
        markThen(d, card, "rotate");
      },
    }),
    costOf: (d: Draft, card: InstanceId) => unmarkedBoxes(d, card)[0]?.cost ?? [],
  }),
  // The White Cowl.
  "Bless (sticker 38) 1 friendly card in play.": () => {
    const targets = (d: Draft, self: InstanceId) => friendlyOthers(d, self).filter((id) => !isKind(d, id, "Blessed"));
    return effect({
      usable: (d, card) => targets(d, card).length > 0,
      ask: steps((d, card) => askCards("Carte bénie (sticker 38)", targets(d, card), 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => placeSticker(d, id, "38")),
    });
  },
  "Choose a blessed card in play and gain its production as resources or use 1 of its {activated} effects.": whiteCowl,
  // Eustace the Mercenary Monk.
  "Spend up to 3 resources to gain that many {sword}.": () => {
    const held = (d: Draft) => d.catalog.resources.filter((r) => r !== "sword").reduce((n, r) => n + (d.s.resources[r] ?? 0), 0);
    return effect({
      usable: (d) => held(d) > 0,
      ask: steps(
        (d) => askOption("Combien de ressources ?", Array.from({ length: Math.min(3, held(d)) }, (_, i) => `${i + 1}`)),
        (d, _card, a) =>
          askResources(
            "Ressources dépensées",
            d.catalog.resources.filter((r) => r !== "sword" && (d.s.resources[r] ?? 0) > 0),
            optionOf(a[0]) + 1,
          ),
      ),
      run: (d, _card, a) => {
        const spend = resourcesOf(a[1]);
        if (!canPayD(d, spend)) return;
        payD(d, spend);
        effectGain(d, spend.map((): ResourceId => "sword"));
      },
    });
  },
  // Ship Wreck : 1 ou 2 cases au choix ; complète, l'épave est détruite.
  "Mark 1-2 {mark}. When complete, {destroy}.": () => {
    const base = freeMark(2, []);
    return {
      ...base,
      apply: (d, card, p) => {
        base.apply(d, card, p);
        const stage = activeStage(d.catalog, d.s, card)?.id;
        if (stage !== undefined && trackComplete(d, card, stage) && canBeDestroyed(d, card)) destroyCards(d, [card]);
      },
    };
  },
  // Prydwen.
  "Make 1 friendly card in play noble (sticker 56).": () => {
    const targets = (d: Draft, self: InstanceId) => friendlyOthers(d, self).filter((id) => !isKind(d, id, "Noble"));
    return effect({
      usable: (d, card) => targets(d, card).length > 0,
      ask: steps((d, card) => askCards("Carte rendue noble (sticker 56)", targets(d, card), 1)),
      run: (d, _card, a) => cardsOf(a[0]).forEach((id) => placeSticker(d, id, "56")),
    });
  },
  // Changeling (verso) : la dernière case le vainc ; il est détruit et une carte amie reçoit un sticker de ressource.
  "Spend {sword}{sword}{sword} to mark 1 {mark}. When complete, defeat ({destroy} and add any resource sticker to 1 friendly card).": () => {
    const last = (d: Draft, card: InstanceId) => unmarkedBoxes(d, card).length === 1;
    const targets = (d: Draft) => kingdom(d.s).filter((id) => friendly(d, id) && canAddResourceSticker(d.catalog, d.s, id));
    return effect({
      cost: ["sword", "sword", "sword"],
      usable: hasFreeBox,
      ask: (d, card, a) => {
        if (!last(d, card) || targets(d).length === 0) return null;
        if (a.length === 0) return askCards("Carte amie qui reçoit un sticker de ressource", targets(d), 1);
        return a.length === 1 ? askResources("Quel sticker de ressource ?", d.catalog.resources, 1) : null;
      },
      run: (d, card, a) => {
        const complete = last(d, card);
        markNext(d, card);
        if (!complete) return;
        const id = cardsOf(a[0])[0];
        const r = resourcesOf(a[1])[0];
        if (id && r) addResourceStickerOf(d, id, r);
        defeat(d, card, []);
      },
    });
  },
  // Morgan le Fey : seulement si Merlin est détruit.
  "Spend {sword}{sword}{sword}{sword}{sword} to defeat ({destroy}, only if Merlin is destroyed).": () =>
    effect({ cost: ["sword", "sword", "sword", "sword", "sword"], usable: (d, card) => canBeDestroyed(d, card), run: (d, card) => defeat(d, card, []) }),
  // Focus Energy.
  "Discard Merlin the Powerful, mark 1 {mark}, and cross out 1 production on 1 card in play to add the corresponding sticker to 1 magical friendly card in play. When complete, {flip}.":
    () => {
      const merlin = (d: Draft) => d.s.zones.play.find((id) => stageName(d, id) === "Merlin the Powerful");
      const producers = (d: Draft) => d.s.zones.play.filter((id) => crossableIcons(d.catalog, d.s, id).length > 0);
      const magical = (d: Draft, without: InstanceId[]) => d.s.zones.play.filter((id) => !without.includes(id) && friendly(d, id) && isMagical(d, id) && canAddResourceSticker(d.catalog, d.s, id));
      const kinds = (d: Draft, id: InstanceId) => [...new Set(crossableIcons(d.catalog, d.s, id).map((x) => x.resource))];
      return effect({
        usable: (d, card) => {
          const m = merlin(d);
          return hasFreeBox(d, card) && m !== undefined && producers(d).length > 0 && magical(d, [m]).length > 0;
        },
        ask: steps(
          (d) => askCards("Carte dont 1 production est rayée", producers(d), 1),
          (d, _card, a) => {
            const id = cardsOf(a[0])[0];
            const rs = id ? kinds(d, id) : [];
            return askResources("Production rayée (et sticker posé)", rs, 1);
          },
          (d) => askCards("Carte amie magique qui reçoit le sticker", magical(d, [merlin(d) ?? ""]), 1),
        ),
        run: (d, card, a) => {
          const m = merlin(d);
          const from = cardsOf(a[0])[0];
          const r = resourcesOf(a[1])[0];
          const to = cardsOf(a[2])[0];
          if (!m || !from || !r || !to) return;
          crossOutIcon(d.catalog, d.s, from, r);
          addResourceStickerOf(d, to, r);
          discardCards(d, [m]);
          markThen(d, card, "flip");
        },
      });
    },
  // Great Power : la case suivante dit combien de cartes magiques défausser.
  "Discard the number of magical cards printed for each spot to increase your power: mark 1 {mark} from left to right.": () => {
    const need = (d: Draft, card: InstanceId) => Number(/Discard (\d+)/.exec(unmarkedBoxes(d, card)[0]?.text ?? "")?.[1] ?? 0);
    const magical = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isMagical(d, id));
    return effect({
      usable: (d, card) => hasFreeBox(d, card) && need(d, card) > 0 && magical(d, card).length >= need(d, card),
      ask: steps((d, card) => askCards(`${need(d, card)} carte(s) magique(s) à défausser`, magical(d, card), need(d, card))),
      run: (d, card, a) => {
        discardCards(d, cardsOf(a[0]));
        markNext(d, card);
      },
    });
  },
};

/** Effets reconnus par motif : « Spend {sword}{sword} to mark 1 {mark}. When complete, {flip} / defeat (…). » */
export function adventurePattern(text: string): (() => EffectImpl) | undefined {
  const m = /^Spend ((?:\{\w+\})+) to mark 1 \{mark\}\. When complete, (defeat \()?\{(flip|rotate|destroy)\}(.*)\.$/.exec(text);
  if (!m || /add any resource sticker/.test(text)) return undefined;
  const cost = [...(m[1] ?? "").matchAll(/\{(\w+)\}/g)].map((x) => x[1] ?? "");
  const isDefeat = m[2] !== undefined;
  const arrow = m[3] === "rotate" ? "rotate" : "flip";
  return () =>
    effect({
      cost,
      usable: hasFreeBox,
      run: (d, card) => {
        const stage = activeStage(d.catalog, d.s, card)?.id;
        markNext(d, card);
        if (stage === undefined || !trackComplete(d, card, stage)) return;
        if (isDefeat) defeat(d, card, []);
        else turnCard(d, card, arrow);
      },
    });
}

/** Effets de type « déclenché » utilisés comme une action (« At any time … »). */
export const ANYTIME_TEXTS = new Set(["At any time, add 1 armor (sticker 55) to 1 person in play or discard pile."]);

// --- Effets déclenchés ---

/** « When played, discard 1 person. », « When played, discard all persons. » */
const discardPersonsOnPlay = (all: boolean) => (): TriggerImpl => {
  const pool = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isPerson(d, id));
  return trigger({
    timing: "played",
    optional: false,
    when: (d, card) => pool(d, card).length > 0,
    ask: (d, card, a) => (!all && a.length === 0 && pool(d, card).length > 1 ? askCards("Personne à défausser", pool(d, card), 1) : null),
    run: (d, card, a) => discardCards(d, all ? pool(d, card) : a.length ? cardsOf(a[0]) : pool(d, card).slice(0, 1)),
  });
};

/** Changeling : « When played: Torment 1 person in play: it is now permanent but cannot be used. » */
const torment = (): TriggerImpl => {
  const pool = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isPerson(d, id));
  return trigger({
    timing: "played",
    optional: false,
    when: (d, card) => d.s.zones.play.includes(card) && pool(d, card).length > 0,
    ask: (d, card, a) => (a.length === 0 && pool(d, card).length > 1 ? askCards("Personne tourmentée", pool(d, card), 1) : null),
    run: (d, card, a) => {
      const id = a.length ? cardsOf(a[0])[0] : pool(d, card)[0];
      const stage = activeStage(d.catalog, d.s, card)?.id;
      if (!id || stage === undefined) return;
      moveTo(d.s, id, "permanent");
      instance(d.s, id).tormentedBy = { card, stage };
      log(d.s, `${cardName(d.catalog, d.s, id)} est tourmentée : permanente, mais inutilisable`);
    },
  });
};

/** « When you discover this, also discover … (17) », « (22, 23 & 24) ». */
const alsoDiscover = (serials: number[]) => (): TriggerImpl => trigger({ timing: "discovered", optional: false, run: (d) => discoverSerials(d, serials) });

/** Lorelei, Nessie : la première personne (ou carte maritime) jouée chaque tour. */
function firstPlayed(keep: (d: Draft, id: InstanceId) => boolean, label: string, act: (d: Draft, card: InstanceId, id: InstanceId) => void): () => TriggerImpl {
  const arrivals = (d: Draft, card: InstanceId, cards: readonly InstanceId[]) => cards.filter((id) => id !== card && d.s.zones.play.includes(id) && keep(d, id));
  return () =>
    trigger({
      timing: ["played", "otherPlayed"],
      optional: false,
      when: (d, card, ctx) => ["play", "permanent"].includes(zoneOf(d.s, card)) && !doneThisTurn(d, card, "firstPlayed") && arrivals(d, card, ctx.cards ?? []).length > 0,
      ask: (d, card, a, ctx) => (a.length === 0 && arrivals(d, card, ctx.cards ?? []).length > 1 ? askCards(label, arrivals(d, card, ctx.cards ?? []), 1) : null),
      run: (d, card, a, ctx) => {
        const id = a.length ? cardsOf(a[0])[0] : arrivals(d, card, ctx.cards ?? [])[0];
        if (!id) return;
        setDoneThisTurn(d, card, "firstPlayed");
        act(d, card, id);
      },
    });
}

/** « Merlin en jeu avec cette carte » : apprentis et Morgan. */
const withMerlin = (d: Draft, card: InstanceId): boolean => d.s.zones.play.includes(card) && merlinInPlay(d, card) !== undefined;

/** Carte des aventures : « Start of Round: mark a location to discover that card. » */
const mapTrigger = (): TriggerImpl => {
  const open = (d: Draft, card: InstanceId) => unmarkedBoxes(d, card).filter((b) => {
    const n = Number(/\((\d+)\)/.exec(b.text ?? "")?.[1] ?? 0);
    return n > 0 && d.s.zones.box.some((id) => instance(d.s, id).serial === n && template(d.catalog, instance(d.s, id).templateId).expansion === "FK_Adventures");
  });
  // Une seule question, dans la fenêtre avec la carte (la carte permanente est trop petite pour y toucher un lieu) :
  // un lieu, ou aucun.
  const label = (text: string | undefined) => (text ?? "").replace(/^Discover (.+?) \((\d+)\)\.$/, "Découvrir $1 ($2)");
  return trigger({
    timing: "roundStart",
    optional: false,
    when: (d, card) => d.s.zones.permanent.includes(card) && open(d, card).length > 0,
    ask: steps((d, card) => askOption("Carte des aventures : cocher un lieu pour découvrir son aventure ?", [...open(d, card).map((b) => label(b.text)), "Ne rien cocher"])),
    run: (d, card, a) => {
      const boxes = open(d, card);
      const touched = boxOf(a[0]);
      const b = touched !== null ? boxes.find((x) => x.id === touched) : boxes[optionOf(a[0])];
      if (!b) {
        log(d.s, "Carte des aventures : aucun lieu coché");
        return;
      }
      markBox(d, card, b.stage, b.id);
      const n = Number(/\((\d+)\)/.exec(b.text ?? "")?.[1] ?? 0);
      if (n) discoverSerials(d, [n]);
    },
  });
};

/** The Green Dragon : se cacher (case verte) ou l'affronter en 3 étapes (celles qu'on peut faire). */
function dragon(): TriggerImpl {
  const pool = (d: Draft, card: InstanceId, without: InstanceId[]) => friendlyOthers(d, card).filter((id) => !without.includes(id));
  /** Question suivante selon les réponses : [choix ?][étape 1][étape 2 carte][étape 2 ressource][étape 3]. */
  const next = (d: Draft, card: InstanceId, a: Answer[]): ChoiceRequest | null => {
    let k = 0;
    const canHide = freeIn(d, card, "green");
    if (canHide) {
      if (a.length === k) return askOption("The Green Dragon : se cacher ou l'affronter ?", ["Se cacher (case verte)", "Affronter le dragon"]);
      if (optionOf(a[k]) === 0) return null;
      k++;
    }
    const used: InstanceId[] = [];
    // 1) Défausser 3 cartes amies.
    if (pool(d, card, used).length >= 3) {
      if (a.length === k) return askCards("1) 3 cartes amies à défausser", pool(d, card, used), 3);
      used.push(...cardsOf(a[k]));
      k++;
    }
    // 2) Rayer 1 production d'une carte amie et la défausser.
    const prod = pool(d, card, used).filter((id) => crossableIcons(d.catalog, d.s, id).length > 0);
    if (prod.length > 0) {
      if (a.length === k) return askCards("2) Carte amie dont 1 production est rayée, puis défaussée", prod, 1);
      const id = cardsOf(a[k])[0];
      used.push(...cardsOf(a[k]));
      k++;
      const rs = id ? [...new Set(crossableIcons(d.catalog, d.s, id).map((x) => x.resource))] : [];
      if (rs.length > 1) {
        if (a.length === k) return askResources("Production rayée", rs, 1);
        k++;
      }
    }
    // 3) Détruire 1 carte amie en jeu.
    const victims = pool(d, card, used).filter((id) => canBeDestroyed(d, id));
    if (victims.length > 0 && a.length === k) return askCards("3) Carte amie à détruire", victims, 1);
    return null;
  };
  return trigger({
    timing: "played",
    optional: false,
    when: (d, card) => d.s.zones.play.includes(card),
    ask: (d, card, a) => next(d, card, a),
    run: (d, card, a) => {
      let k = 0;
      if (freeIn(d, card, "green")) {
        if (optionOf(a[k]) === 0) {
          markNextIn(d, card, "green");
          log(d.s, "On se cache du dragon");
          return;
        }
        k++;
      }
      const used: InstanceId[] = [];
      const white = () => {
        if (d.s.zones.play.includes(card)) markNextIn(d, card, "white");
      };
      if (pool(d, card, used).length >= 3) {
        const ids = cardsOf(a[k++]);
        used.push(...ids);
        discardCards(d, ids);
        white();
      }
      const prod = friendlyOthers(d, card).filter((id) => !used.includes(id) && crossableIcons(d.catalog, d.s, id).length > 0);
      if (prod.length > 0) {
        const id = cardsOf(a[k++])[0];
        if (id) {
          used.push(id);
          const rs = [...new Set(crossableIcons(d.catalog, d.s, id).map((x) => x.resource))];
          const r = rs.length > 1 ? resourcesOf(a[k++])[0] : rs[0];
          if (r) crossOutIcon(d.catalog, d.s, id, r);
          discardCards(d, [id]);
          white();
        }
      }
      const victim = cardsOf(a[k])[0];
      if (victim) {
        destroyCards(d, [victim]);
        white();
      }
      const stage = activeStage(d.catalog, d.s, card);
      const whites = stage ? stage.checkboxes.filter((b) => b.group === "white") : [];
      if (stage && whites.length && whites.every((b) => instance(d.s, card).checkedBoxes.includes(`${stage.id}/${b.id}`))) turnCard(d, card, "flip");
    },
  });
}

export const ADVENTURE_TRIGGERS: Record<string, () => TriggerImpl> = {
  "Start of Round: mark a location to discover that card.": mapTrigger,
  "When played, discard 1 person.": discardPersonsOnPlay(false),
  "When played, discard all persons.": discardPersonsOnPlay(true),
  "When played: Torment 1 person in play: it is now permanent but cannot be used.": torment,
  // Merlin the Wise.
  "When played, discover Apprentice (27).": () => trigger({ timing: "played", optional: false, run: (d) => discoverSerials(d, [27]) }),
  // Ghost Ship, Wheel of Fortune : la carte du dessous du deck.
  "When played, discard the bottom card of your deck.": () =>
    trigger({
      timing: "played",
      optional: false,
      when: (d) => d.s.zones.deck.length > 0,
      run: (d) => {
        const id = d.s.zones.deck.at(-1);
        if (!id) return;
        d.s.revealCount += 1;
        discard(d, id);
        log(d.s, `${cardName(d.catalog, d.s, id)} est défaussée du dessous du deck`);
      },
    }),
  "When played, blocks the bottom card of your deck.": () =>
    trigger({
      timing: "played",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card) && d.s.zones.deck.length > 0,
      run: (d, card) => {
        const id = d.s.zones.deck.at(-1);
        if (!id) return;
        d.s.revealCount += 1;
        moveTo(d.s, id, "blocked");
        const blocks = (d.s.blocks ??= {});
        blocks[card] = [...(blocks[card] ?? []), id];
        log(d.s, `${cardName(d.catalog, d.s, card)} bloque ${cardName(d.catalog, d.s, id)} (dessous du deck)`);
      },
    }),
  // Trading With Pixies.
  "End of Turn: If you haven't marked any {mark} this turn, destroy 1 friendly card in discard pile.": () => {
    const pool = (d: Draft) => d.s.zones.discard.filter((id) => friendly(d, id) && canBeDestroyed(d, id));
    return trigger({
      timing: "endTurn",
      optional: false,
      when: (d, card) => d.s.zones.permanent.includes(card) && !doneThisTurn(d, card, "mark") && pool(d).length > 0,
      ask: (d, _card, a) => (a.length === 0 && pool(d).length > 1 ? askCards("Trading With Pixies : carte amie de la défausse à détruire", pool(d), 1) : null),
      run: (d, _card, a) => destroyCards(d, a.length ? cardsOf(a[0]) : pool(d).slice(0, 1)),
    });
  },
  "When you discover this, also discover Eustace (17).": alsoDiscover([17]),
  "When you discover this, also discover 2 ship wrecks (18 & 19).": alsoDiscover([18, 19]),
  "When discovered, also discover 3 Wild Men (22, 23 & 24).": alsoDiscover([22, 23, 24]),
  // Jack-in-Irons.
  "When red OR green track is complete, defeat ({flip}).": () => {
    const complete = (d: Draft, card: InstanceId, group: string) => {
      const stage = activeStage(d.catalog, d.s, card);
      const boxes = stage ? stage.checkboxes.filter((b) => b.group === group) : [];
      return boxes.length > 0 && boxes.every((b) => instance(d.s, card).checkedBoxes.includes(`${stage?.id}/${b.id}`));
    };
    return trigger({
      timing: "check",
      optional: false,
      when: (d, card) => ["play", "permanent"].includes(zoneOf(d.s, card)) && (complete(d, card, "red") || complete(d, card, "green")),
      run: (d, card) => defeat(d, card, []),
    });
  },
  "End of Round: Destroy 1 person or 2 other friendly cards.": () => {
    const people = (d: Draft, self: InstanceId) => kingdom(d.s).filter((id) => id !== self && isPerson(d, id) && canBeDestroyed(d, id));
    const others = (d: Draft, self: InstanceId) => kingdom(d.s).filter((id) => id !== self && friendly(d, id) && canBeDestroyed(d, id));
    return trigger({
      timing: "endRound",
      optional: false,
      when: (d, card) => d.s.zones.permanent.includes(card) && others(d, card).length > 0,
      ask: (d, card, a) => {
        const canPerson = people(d, card).length > 0;
        const canTwo = others(d, card).length >= 2;
        if (a.length === 0 && canPerson && canTwo) return askOption("Jack-in-Irons : que détruire ?", ["1 personne", "2 autres cartes amies"]);
        const k = canPerson && canTwo ? 1 : 0;
        if (a.length !== k) return null;
        const two = canPerson && canTwo ? optionOf(a[0]) === 1 : !canPerson;
        return two ? askCards("2 cartes amies à détruire", others(d, card), 2) : askCards("Personne à détruire", people(d, card), 1);
      },
      run: (d, card, a) => {
        const k = people(d, card).length > 0 && others(d, card).length >= 2 ? 1 : 0;
        destroyCards(d, cardsOf(a[k]));
      },
    });
  },
  // Lorelei, Nessie.
  "Discard the first person you play each turn.": firstPlayed(isPerson, "Personne défaussée par Lorelei", (d, _card, id) => discardCards(d, [id])),
  "Blocks the first seafaring card or person played each turn, getting more and more blocked cards.": firstPlayed(
    (d, id) => isPerson(d, id) || isSeafaring(d, id),
    "Carte bloquée par Nessie",
    (d, card, id) => blockCards(d, card, [id]),
  ),
  "End of Round: Destroy 1 blocked card.": () => {
    const held = (d: Draft, card: InstanceId) => (d.s.blocks?.[card] ?? []).filter((id) => canBeDestroyed(d, id));
    return trigger({
      timing: "endRound",
      optional: false,
      when: (d, card) => held(d, card).length > 0,
      ask: (d, card, a) => (a.length === 0 && held(d, card).length > 1 ? askCards("Carte bloquée à détruire", held(d, card), 1) : null),
      run: (d, card, a) => {
        const ids = a.length ? cardsOf(a[0]) : held(d, card).slice(0, 1);
        if (d.s.blocks?.[card]) d.s.blocks[card] = (d.s.blocks[card] ?? []).filter((id) => !ids.includes(id));
        destroyCards(d, ids);
      },
    });
  },
  // Battling the Pagans.
  "End of Round: Cross out all {sword} production on 1 card with {sword} production.": () => {
    const targets = (d: Draft) => kingdom(d.s).filter((id) => crossableIcons(d.catalog, d.s, id, "sword").length > 0);
    return trigger({
      timing: "endRound",
      optional: false,
      when: (d) => targets(d).length > 0,
      ask: (d, _card, a) => (a.length === 0 && targets(d).length > 1 ? askCards("Carte dont toute la production de {sword} est rayée", targets(d), 1) : null),
      run: (d, _card, a) => {
        const id = a.length ? cardsOf(a[0])[0] : targets(d)[0];
        if (!id) return;
        while (crossOutIcon(d.catalog, d.s, id, "sword"));
        log(d.s, `${cardName(d.catalog, d.s, id)} : production de {sword} rayée`);
      },
    });
  },
  // The Pied Piper.
  "When played, blocks 1 person.": () => {
    const pool = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isPerson(d, id));
    return trigger({
      timing: "played",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card) && pool(d, card).length > 0,
      ask: (d, card, a) => (a.length === 0 && pool(d, card).length > 1 ? askCards("Personne bloquée", pool(d, card), 1) : null),
      run: (d, card, a) => blockCards(d, card, a.length ? cardsOf(a[0]) : pool(d, card).slice(0, 1)),
    });
  },
  "End of Turn: Destroy the blocked person OR spend {coin}{coin}{coin}{coin} to mark 1 {mark} (from left to right).": () => {
    const cost: ResourceId[] = ["coin", "coin", "coin", "coin"];
    const blocked = (d: Draft, card: InstanceId) => (d.s.blocks?.[card] ?? []).filter((id) => isPerson(d, id) && canBeDestroyed(d, id));
    const ways = (d: Draft, card: InstanceId) => [
      ...(blocked(d, card).length ? ["destroy"] : []),
      ...(hasFreeBox(d, card) && canPayD(d, cost) ? ["pay"] : []),
    ];
    return trigger({
      timing: "endTurn",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card) && ways(d, card).length > 0,
      ask: (d, card, a) =>
        a.length === 0 && ways(d, card).length > 1 ? askOption("The Pied Piper", ["Détruire la personne bloquée", `Dépenser ${iconText(cost)} pour cocher 1 case`]) : null,
      run: (d, card, a) => {
        const list = ways(d, card);
        const way = list.length > 1 ? list[optionOf(a[0])] : list[0];
        if (way === "destroy") {
          const id = blocked(d, card)[0];
          if (!id) return;
          if (d.s.blocks?.[card]) d.s.blocks[card] = (d.s.blocks[card] ?? []).filter((x) => x !== id);
          destroyCards(d, [id]);
          return;
        }
        payD(d, cost);
        markNext(d, card);
      },
    });
  },
  // Hamelin.
  "Whenever a negative ({negative}) card is in play, discard this.": () =>
    trigger({
      timing: "check",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card) && otherInPlay(d, card, (id) => !friendly(d, id)).length > 0,
      run: (d, card) => discardCards(d, [card]),
    }),
  "When played, either mark 1 {mark} on green to hide, or face the dragon by doing the following 3 things in order (skip those you cannot perform): 1) Discard 3 friendly cards to mark 1 {mark}. 2) Cross out 1 production on 1 friendly card and discard it to mark 1 {mark}. 3) Destroy 1 friendly card to mark 1 {mark}. When the white track is complete, {flip}.":
    dragon,
  // Eustace the Pirate Monk.
  "When played, discard 1 friendly card with production and cross out 1 production on it.": () => {
    const pool = (d: Draft, self: InstanceId) => friendlyOthers(d, self).filter((id) => crossableIcons(d.catalog, d.s, id).length > 0);
    return trigger({
      timing: "played",
      optional: false,
      when: (d, card) => pool(d, card).length > 0,
      ask: (d, card, a) => (a.length === 0 && pool(d, card).length > 1 ? askCards("Carte amie défaussée, 1 production rayée", pool(d, card), 1) : null),
      run: (d, card, a) => {
        const id = a.length ? cardsOf(a[0])[0] : pool(d, card)[0];
        if (!id) return;
        if (crossOutProduction(d.catalog, d.s, id)) log(d.s, `${cardName(d.catalog, d.s, id)} : 1 production rayée`);
        discardCards(d, [id]);
      },
    });
  },
  // Ancient : empêcher la fin du tour.
  "End of Turn: Discard and mark 1 {mark} to prevent the turn from ending.": () =>
    trigger({
      timing: "endTurn",
      optional: true,
      prompt: "Ancient : le défausser et cocher 1 case pour que le tour continue ?",
      when: (d, card) => d.s.zones.play.includes(card) && hasFreeBox(d, card),
      run: (d, card) => {
        markNext(d, card);
        discardCards(d, [card]);
        // Le reste de la fin du tour (autres effets « End of Turn », défausse) est annulé : le tour continue.
        const end = d.s.queue.findIndex((step) => step.kind === "cleanupTurn");
        if (end >= 0) d.s.queue.splice(0, end + 1);
        log(d.s, "Le tour continue");
      },
    }),
  // The Flying Dutchman.
  "When played, discard 1 other ship in play. Add 1 resource sticker here corresponding to 1 production on the discarded ship, if any. If this now produces 6 or more resources, {oneTime}.":
    () => {
      const ships = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isKind(d, id, "Ship"));
      const kinds = (d: Draft, id: InstanceId) => [...new Set(productionGroups(d.catalog, d.s, id).flatMap((g) => g.options.flat()))];
      return trigger({
        timing: "played",
        optional: false,
        when: (d, card) => d.s.zones.play.includes(card) && ships(d, card).length > 0,
        ask: steps(
          (d, card) => (ships(d, card).length > 1 ? askCards("Navire à défausser", ships(d, card), 1) : null),
          (d, card, a) => {
            const id = cardsOf(a[0])[0] ?? ships(d, card)[0];
            const rs = id ? kinds(d, id) : [];
            return rs.length > 1 ? askResources("Sticker de ressource ajouté ici", rs, 1) : null;
          },
        ),
        run: (d, card, a) => {
          const id = cardsOf(a[0])[0] ?? ships(d, card)[0];
          if (!id) return;
          const r = resourcesOf(a[1])[0] ?? kinds(d, id)[0];
          discardCards(d, [id]);
          if (r) addResourceStickerOf(d, card, r);
          if (productionCount(d.catalog, d.s, card) >= 6) {
            const stage = activeStage(d.catalog, d.s, card);
            const e = stage?.effects.find((x) => x.text.startsWith("When played, discard 1 other ship in play."));
            if (stage && e) instance(d.s, card).crossedOutEffects.push(`${stage.id}/${e.id}`);
            log(d.s, `${cardName(d.catalog, d.s, card)} produit 6 ressources ou plus : son effet est rayé`);
          }
        },
      });
    },
  // Prydwen : lancé à la place de la défausse d'une carte noble qui produit (effects/substitutes.ts).
  "When you produce with a noble card, discard this instead.": () =>
    trigger({
      timing: "manual",
      optional: true,
      prompt: "Prydwen : la défausser à la place de la carte noble qui produit ?",
      run: (d) => {
        const p = d.s.zones.play.find((id) => stageName(d, id) === "Prydwen");
        if (p) discardCards(d, [p]);
      },
      decline: (d, card) => discardCards(d, [card]),
    }),
  // Young / Adept Apprentice.
  "If in play with Merlin, discard both and mark 1 {mark}. When complete, {rotate}.": () => apprentice("rotate"),
  "If in play with Merlin, discard both and mark 1 {mark}. When complete, {flip}.": () => apprentice("flip"),
  // Morgan le Fey.
  "When played, discard the top card of your deck for each {mark} here.": () =>
    trigger({
      timing: "played",
      optional: false,
      run: (d, card) => {
        const stage = activeStage(d.catalog, d.s, card)?.id;
        const marks = instance(d.s, card).checkedBoxes.filter((k) => k.startsWith(`${stage}/`)).length;
        discardFromDeck(d, marks);
      },
    }),
  "If ever in play with Merlin, mark 1 {mark} or destroy both.": () =>
    trigger({
      timing: "check",
      optional: false,
      when: (d, card) => withMerlin(d, card) && !doneThisTurn(d, card, "merlin"),
      ask: (d, card, a) => (a.length === 0 && hasFreeBox(d, card) ? askOption("Morgan le Fey et Merlin en jeu", ["Cocher 1 case", "Détruire Merlin et Morgan"]) : null),
      run: (d, card, a) => {
        setDoneThisTurn(d, card, "merlin");
        if (hasFreeBox(d, card) && optionOf(a[0]) !== 1) {
          markNext(d, card);
          return;
        }
        const m = merlinInPlay(d, card);
        if (m) destroyCards(d, [m]);
        destroyCards(d, [card]);
      },
    }),
};

function apprentice(arrow: "rotate" | "flip"): TriggerImpl {
  return trigger({
    timing: "check",
    optional: false,
    when: withMerlin,
    run: (d, card) => {
      const m = merlinInPlay(d, card);
      const stage = activeStage(d.catalog, d.s, card)?.id;
      markNext(d, card);
      if (m) discardCards(d, [m]);
      if (stage !== undefined && activeStage(d.catalog, d.s, card)?.id === stage && trackComplete(d, card, stage)) turnCard(d, card, arrow);
      else if (d.s.zones.play.includes(card)) discardCards(d, [card]);
    },
  });
}
