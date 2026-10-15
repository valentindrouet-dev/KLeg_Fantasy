import type { ResourceId } from "../../data/schema";
import { askCards, askPersons, askResources, cardsOf, resourcesOf } from "../choice";
import { playCard, staysInPlay } from "../flow";
import {
  blockCards,
  boxesOf,
  canBeDestroyed,
  canPayD,
  destroyCards,
  discardCards,
  effectGain,
  friendly,
  isEnemy,
  isKind,
  isMarked,
  kingdom,
  markBox,
  otherInPlay,
  payD,
  stageName,
  turnCard,
  unmarkedBoxes,
} from "../ops";
import { swordsOnlyForUpgrades } from "../passives";
import { canAddResourceSticker, crossableIcons, crossOutIcon, crossOutProduction, productionGroups } from "../production";
import { shuffle } from "../rng";
import { activeStage, cardName, countPersons, instance, log, personWeight } from "../state";
import type { Draft, EffectImpl, InstanceId, TriggerImpl } from "../types";
import { applyBoxText, defeat, effect, icon, markNext, persons, placeSticker, steps, trigger } from "./cards";

// Effets des cartes de l'extension Ridding the Woods (cartes 00 à 29), reconnus à leur texte imprimé exact, comme ceux
// de Feudal Kingdom (effects/cards.ts). Lancement, purge (focus, Prisonniers), 5 manches de 5 découvertes : campaign.ts.
// Interdictions (Robbin' Leader, Huge Robber, camps, Sobbing) : passives.ts. Décisions : docs/RULES_DECISIONS.md.
// Rien ici ne doit appeler cards.ts au chargement du module (import circulaire) : seulement dans les fabriques.

const expand = (text: string): ResourceId[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "");

const isPrisoner = (d: Draft, id: InstanceId): boolean => stageName(d, id) === "Prisoner";
const enemiesInPlay = (d: Draft, self: InstanceId): InstanceId[] => otherInPlay(d, self, (id) => isEnemy(d, id));
const discardOf = (d: Draft, self: InstanceId, keep: (id: InstanceId) => boolean): InstanceId[] =>
  d.s.zones.discard.filter((id) => id !== self && keep(id));
const hasFreeBox = (d: Draft, card: InstanceId): boolean => unmarkedBoxes(d, card).length > 0;
const friendlyOthers = (d: Draft, self: InstanceId): InstanceId[] => otherInPlay(d, self, (id) => friendly(d, id));

/** Coche la case suivante d'une piste de couleur (The Chase : verte, rouge) et applique son texte. */
function markNextIn(d: Draft, card: InstanceId, group: string): boolean {
  const next = boxesOf(d.catalog, d.s, card).find((b) => b.group === group && !isMarked(d.s, card, b.stage, b.id));
  if (!next) return false;
  markBox(d, card, next.stage, next.id);
  applyBoxText(d, card, next.text);
  return true;
}

const freeIn = (d: Draft, card: InstanceId, group: string): boolean =>
  boxesOf(d.catalog, d.s, card).some((b) => b.group === group && !isMarked(d.s, card, b.stage, b.id));

/** Coche jusqu'à n cases de gauche à droite, tant que la carte garde le même stage (une case peut la retourner). */
function markUpTo(d: Draft, card: InstanceId, n: number): void {
  const stage = activeStage(d.catalog, d.s, card)?.id;
  for (let i = 0; i < n; i++) {
    if (activeStage(d.catalog, d.s, card)?.id !== stage || !markNext(d, card)) return;
  }
}

/** Joue une carte de la défausse (log compris). */
function playFromDiscard(d: Draft, id: InstanceId): void {
  log(d.s, `${cardName(d.catalog, d.s, id)} est jouée depuis la défausse`);
  playCard(d, id);
}

/**
 * Robbin' Leader vaincu (piste complète, ou vaincu d'un coup par The Army) : « If you have A Certain Lady, destroy her
 * from anywhere (reshuffle the deck if she was there) and {flip}. Otherwise, destroy this. »
 */
export function robbinDefeated(d: Draft, enemy: InstanceId): void {
  const lady = kingdom(d.s).find((id) => stageName(d, id) === "A Certain Lady" && canBeDestroyed(d, id));
  if (!lady) {
    destroyCards(d, [enemy]);
    return;
  }
  const inDeck = d.s.zones.deck.includes(lady);
  destroyCards(d, [lady]);
  if (inDeck) {
    const r = shuffle(d.s.zones.deck, d.s.rng);
    d.s.rng = r.state;
    d.s.zones.deck = r.items;
    d.s.revealCount += 1;
    log(d.s, "Le deck est remélangé");
  }
  turnCard(d, enemy, "flip");
}

// --- Effets utilisés comme action, par texte exact ---

/** Défausse des cartes amies en jeu (3, 2… par ennemi joué) : le joueur choisit s'il en a plus qu'il n'en faut. */
function discardFriendlyOnEnemy(n: number): () => TriggerImpl {
  const arrivals = (d: Draft, card: InstanceId, cards: readonly InstanceId[]) => cards.filter((id) => id !== card && d.s.zones.play.includes(id) && isEnemy(d, id));
  const pool = (d: Draft) => d.s.zones.play.filter((id) => friendly(d, id));
  const need = (d: Draft, card: InstanceId, cards: readonly InstanceId[]) => n * arrivals(d, card, cards).length;
  return () =>
    trigger({
      timing: ["played", "otherPlayed"],
      optional: false,
      when: (d, card, ctx) => d.s.zones.play.includes(card) && need(d, card, ctx.cards ?? []) > 0 && pool(d).length > 0,
      ask: (d, card, a, ctx) => {
        const k = need(d, card, ctx.cards ?? []);
        return a.length === 0 && pool(d).length > k ? askCards(`${k} cartes amies à défausser`, pool(d), k) : null;
      },
      run: (d, card, a, ctx) => discardCards(d, a.length ? cardsOf(a[0]) : pool(d).slice(0, need(d, card, ctx.cards ?? []))),
    });
}

/** « When played, discard all cards with {wood} production. » */
const discardProducers = (r: ResourceId) => (): TriggerImpl => {
  const targets = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => productionGroups(d.catalog, d.s, id).some((g) => g.options.some((o) => o.includes(r))));
  return trigger({
    timing: "played",
    optional: false,
    when: (d, card) => d.s.zones.play.includes(card) && targets(d, card).length > 0,
    run: (d, card) => discardCards(d, targets(d, card)),
  });
};

/** « When played, play 1 enemy / Prisoner / Robbin' Leader from discard pile. » */
const playOnPlay = (label: string, keep: (d: Draft, id: InstanceId) => boolean) => (): TriggerImpl => {
  const options = (d: Draft, self: InstanceId) => discardOf(d, self, (id) => keep(d, id));
  return trigger({
    timing: "played",
    optional: false,
    when: (d, card) => options(d, card).length > 0,
    ask: (d, card, a) => (a.length === 0 && options(d, card).length > 1 ? askCards(label, options(d, card), 1) : null),
    run: (d, card, a) => {
      const id = a.length ? cardsOf(a[0])[0] : options(d, card)[0];
      if (id) playFromDiscard(d, id);
    },
  });
};

const gainOnPlay = (n: number) => (): TriggerImpl =>
  trigger({
    timing: "played",
    optional: false,
    ask: steps((d) => askResources(`Choisis ${n} ressources`, d.catalog.resources, n)),
    run: (d, _card, a) => effectGain(d, resourcesOf(a[0])),
  });

export const RIDDING_EFFECTS: Record<string, () => EffectImpl> = {
  // Robbin' Leader : chaque défaite coche une case ; la piste complète, il est vaincu (voir robbinDefeated).
  "Spend {sword}{sword}{sword} to defeat (mark 1 {mark} from left to right). When complete: If you have A Certain Lady, destroy her from anywhere (reshuffle the deck if she was there) and {flip}. Otherwise, destroy this.":
    () =>
      effect({
        cost: ["sword", "sword", "sword"],
        usable: hasFreeBox,
        run: (d, card) => {
          markNext(d, card);
          if (!hasFreeBox(d, card)) defeat(d, card, []);
        },
      }),
  // Huge Robber.
  "Discard 4 persons to defeat ({flip}).": () =>
    effect({
      usable: (d, card) => countPersons(d.catalog, d.s, persons(d, card)) >= 4,
      ask: steps((d, card) => askPersons("4 personnes à défausser", persons(d, card), 4, (id) => personWeight(d.catalog, d.s, id))),
      run: (d, card, a) => {
        discardCards(d, cardsOf(a[0]));
        defeat(d, card, []);
      },
    }),
  // Sheriff, Feared Sheriff (passif : à volonté).
  "Discard 1 land to gain any 2 resources.": () => {
    const lands = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isKind(d, id, "Land"));
    return effect({
      usable: (d, card) => lands(d, card).length > 0,
      ask: steps(
        (d, card) => askCards("Terre à défausser", lands(d, card), 1),
        (d) => askResources("Choisis 2 ressources", d.catalog.resources, 2),
      ),
      run: (d, _card, a) => {
        discardCards(d, cardsOf(a[0]));
        effectGain(d, resourcesOf(a[1]));
      },
    });
  },
  // Archery Contest.
  "Mark 1 {mark} from left to right to play 1 enemy from discard pile.": () => {
    const enemies = (d: Draft, self: InstanceId) => discardOf(d, self, (id) => isEnemy(d, id));
    return effect({
      usable: (d, card) => hasFreeBox(d, card) && enemies(d, card).length > 0,
      ask: steps((d, card) => askCards("Ennemi à jouer depuis la défausse", enemies(d, card), 1)),
      run: (d, card, a) => {
        markNext(d, card);
        for (const id of cardsOf(a[0])) playFromDiscard(d, id);
      },
    });
  },
  // Bait and Trap.
  "If you have a lady in play, play 1 enemy from discard pile, then gain {sword}{sword}.": () => {
    const enemies = (d: Draft, self: InstanceId) => discardOf(d, self, (id) => isEnemy(d, id));
    return effect({
      usable: (d, card) => otherInPlay(d, card, (id) => isKind(d, id, "Lady")).length > 0 && enemies(d, card).length > 0,
      ask: steps((d, card) => askCards("Ennemi à jouer depuis la défausse", enemies(d, card), 1)),
      run: (d, _card, a) => {
        for (const id of cardsOf(a[0])) playFromDiscard(d, id);
        effectGain(d, ["sword", "sword"]);
      },
    });
  },
  // Small Dungeon.
  "Discard any number of prisoners to mark 1 {mark} from left to right for each.": () => {
    const prisoners = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isPrisoner(d, id));
    return effect({
      usable: (d, card) => hasFreeBox(d, card) && prisoners(d, card).length > 0,
      ask: steps((d, card) => askCards("Prisonniers à défausser", prisoners(d, card), 1, Math.min(prisoners(d, card).length, unmarkedBoxes(d, card).length))),
      run: (d, card, a) => {
        const ids = cardsOf(a[0]);
        discardCards(d, ids);
        markUpTo(d, card, ids.length);
      },
    });
  },
  // Large Dungeon (passif) : le compte des prisonniers défaussés, 2 {fame} chacun (score.ts).
  "Discard 1 prisoner and keep track of how many you have discarded below.": () => {
    const prisoners = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => isPrisoner(d, id));
    return effect({
      usable: (d, card) => prisoners(d, card).length > 0,
      ask: steps((d, card) => askCards("Prisonnier à défausser", prisoners(d, card), 1)),
      run: (d, card, a) => {
        const stage = activeStage(d.catalog, d.s, card)?.id;
        if (stage === undefined) return;
        discardCards(d, cardsOf(a[0]));
        const c = instance(d.s, card);
        const key = String(stage);
        c.tallies = { ...(c.tallies ?? {}), [key]: (c.tallies?.[key] ?? 0) + 1 };
        log(d.s, `${cardName(d.catalog, d.s, card)} : ${c.tallies[key]} prisonnier(s) défaussé(s)`);
      },
    });
  },
  // Obedient Bard.
  "Mark 1 {mark} to play 1 event from discard pile.": () => {
    const events = (d: Draft, self: InstanceId) => discardOf(d, self, (id) => isKind(d, id, "Event"));
    return effect({
      usable: (d, card) => hasFreeBox(d, card) && events(d, card).length > 0,
      ask: steps((d, card) => askCards("Événement à jouer depuis la défausse", events(d, card), 1)),
      run: (d, card, a) => {
        markNext(d, card);
        for (const id of cardsOf(a[0])) playFromDiscard(d, id);
      },
    });
  },
  // Ceremony.
  "Discard 5 friendly cards from play. Add sticker 10 to 1 of them. Then {rotate}.": () =>
    effect({
      usable: (d, card) => friendlyOthers(d, card).length >= 5,
      ask: steps(
        (d, card) => askCards("5 cartes amies à défausser", friendlyOthers(d, card), 5),
        (_d, _card, a) => askCards("Carte qui reçoit le sticker 10", cardsOf(a[0]), 1),
      ),
      run: (d, card, a) => {
        for (const id of cardsOf(a[1])) placeSticker(d, id, "10");
        discardCards(d, cardsOf(a[0]));
        turnCard(d, card, "rotate");
      },
    }),
  // The Chase : piste verte (la 3e case retourne la carte : Ether Connector).
  "Discard 6 friendly cards to mark 1 green {mark} from left to right.": () =>
    effect({
      usable: (d, card) => freeIn(d, card, "green") && friendlyOthers(d, card).length >= 6,
      ask: steps((d, card) => askCards("6 cartes amies à défausser", friendlyOthers(d, card), 6)),
      run: (d, card, a) => {
        discardCards(d, cardsOf(a[0]));
        markNextIn(d, card, "green");
      },
    }),
};

/** Effets reconnus par motif : rayer une icône du coût d'amélioration, cocher une case en payant. */
export function riddingPattern(text: string): (() => EffectImpl) | undefined {
  // Powerful Prince, Sheriff : « Spend {coin}{coin}{coin} to cross out 1 {coin} from the upgrade cost. »
  const cross = /^Spend ((?:\{\w+\})+) to cross out 1 \{(\w+)\} from the upgrade cost\.$/.exec(text);
  if (cross) {
    const cost = expand(cross[1] ?? "");
    const r = cross[2] ?? "";
    const next = (d: Draft, card: InstanceId): string | null => {
      const stage = activeStage(d.catalog, d.s, card);
      const crossed = instance(d.s, card).crossedOutCosts ?? [];
      for (const u of stage?.upgrades ?? []) {
        const i = u.cost.findIndex((x, idx) => x === r && !crossed.includes(`${stage?.id}/${u.id}/${idx}`));
        if (i >= 0) return `${stage?.id}/${u.id}/${i}`;
      }
      return null;
    };
    return () =>
      effect({
        cost,
        usable: (d, card) => next(d, card) !== null,
        run: (d, card) => {
          const key = next(d, card);
          if (!key) return;
          const c = instance(d.s, card);
          c.crossedOutCosts = [...(c.crossedOutCosts ?? []), key];
          log(d.s, `${cardName(d.catalog, d.s, card)} : 1 ${icon(r)} rayé du coût`);
        },
      });
  }
  // Old Oak Tree : « Spend {metal}{metal} to mark 1 {mark} from left to right. »
  const mark = /^Spend ((?:\{\w+\})+) to mark 1 \{mark\} from left to right\.$/.exec(text);
  if (mark) {
    const cost = expand(mark[1] ?? "");
    return () => effect({ cost, usable: hasFreeBox, run: (d, card) => void markNext(d, card) });
  }
  return undefined;
}

// --- Effets déclenchés ---

export const RIDDING_TRIGGERS: Record<string, () => TriggerImpl> = {
  // A Certain Lady : un ennemi en jeu avec elle (déjà là quand elle arrive, ou arrivé ensuite) coche une case.
  "Mark 1 {mark} for each enemy which is in play with this card. After finishing Ridding the Woods, {oneTime}.": () => {
    const count = (d: Draft, card: InstanceId, cards: readonly InstanceId[]) =>
      cards.includes(card) ? enemiesInPlay(d, card).length : cards.filter((id) => id !== card && d.s.zones.play.includes(id) && isEnemy(d, id)).length;
    return trigger({
      timing: ["played", "otherPlayed"],
      optional: false,
      when: (d, card, ctx) => d.s.zones.play.includes(card) && hasFreeBox(d, card) && count(d, card, ctx.cards ?? []) > 0,
      run: (d, card, _a, ctx) => markUpTo(d, card, count(d, card, ctx.cards ?? [])),
    });
  },
  // Rogue Lady.
  "When played, cross out 1 {coin} production on 1 card in play. If you do, mark 1 {mark} from left to right.": () => {
    const targets = (d: Draft) => d.s.zones.play.filter((id) => crossableIcons(d.catalog, d.s, id, "coin").length > 0);
    return trigger({
      timing: "played",
      optional: false,
      when: (d) => targets(d).length > 0,
      ask: (d, _card, a) => (a.length === 0 && targets(d).length > 1 ? askCards("Carte dont 1 production de {coin} est rayée", targets(d), 1) : null),
      run: (d, card, a) => {
        const id = a.length ? cardsOf(a[0])[0] : targets(d)[0];
        if (!id || !crossOutIcon(d.catalog, d.s, id, "coin")) return;
        log(d.s, `${cardName(d.catalog, d.s, id)} : 1 {coin} rayée`);
        if (d.s.zones.play.includes(card)) markNext(d, card);
      },
    });
  },
  // Bandit, Robber Veteran.
  "When played, discard all cards with {wood} production.": discardProducers("wood"),
  "When played, discard all cards with {coin} production.": discardProducers("coin"),
  // Prisoner : condition d'état, vérifiée quand plus rien n'est en attente (flow.ts).
  "If there are 2 enemies in play, {flip}.": () =>
    trigger({
      timing: "check",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card) && enemiesInPlay(d, card).length >= 2,
      run: (d, card) => turnCard(d, card, "flip"),
    }),
  // Lousy Guard, Impatient Guard.
  "If there is no enemy in play, discard this.": () =>
    trigger({
      timing: "check",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card) && enemiesInPlay(d, card).length === 0,
      run: (d, card) => discardCards(d, [card]),
    }),
  // Robber Forest.
  "When played, play Robbin' Leader from discard pile.": playOnPlay("Robbin' Leader", (d, id) => stageName(d, id) === "Robbin' Leader"),
  // Unsafe Forest.
  "When you defeat an enemy, spend {coin}{coin}{coin}{coin}{sword}{sword} to {flip}.": () => {
    const cost: ResourceId[] = ["coin", "coin", "coin", "coin", "sword", "sword"];
    return trigger({
      timing: "enemyDefeated",
      optional: true,
      prompt: "Unsafe Forest : dépenser {coin}{coin}{coin}{coin}{sword}{sword} pour la retourner ?",
      when: (d, card) => d.s.zones.play.includes(card) && canPayD(d, cost) && swordsOnlyForUpgrades(d.catalog, d.s).length === 0,
      run: (d, card) => {
        payD(d, cost);
        turnCard(d, card, "flip");
      },
    });
  },
  // Terrified Town, Uneasy Town.
  "When an enemy is played, discard 3 friendly cards.": discardFriendlyOnEnemy(3),
  "When an enemy is played, discard 2 friendly cards.": discardFriendlyOnEnemy(2),
  // Tax Collector.
  "When you produce with this, mark 1 {mark}.": () =>
    trigger({ timing: "produced", optional: false, when: hasFreeBox, run: (d, card) => void markNext(d, card) }),
  // Brave Knight, Bard of the People, Old Oak Tree.
  "When played, play 1 enemy from discard pile.": playOnPlay("Ennemi à jouer depuis la défausse", (d, id) => isEnemy(d, id)),
  // Treasure Wagon.
  "When played, if an enemy is in play, cross out 1 production here.": () =>
    trigger({
      timing: "played",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card) && enemiesInPlay(d, card).length > 0,
      run: (d, card) => {
        if (crossOutProduction(d.catalog, d.s, card)) log(d.s, `${cardName(d.catalog, d.s, card)} : 1 production rayée`);
      },
    }),
  "When an enemy is played, cross out 1 production here.": () => {
    const arrivals = (d: Draft, card: InstanceId, cards: readonly InstanceId[]) => cards.filter((id) => id !== card && d.s.zones.play.includes(id) && isEnemy(d, id));
    return trigger({
      timing: "otherPlayed",
      optional: false,
      when: (d, card, ctx) => d.s.zones.play.includes(card) && arrivals(d, card, ctx.cards ?? []).length > 0,
      run: (d, card, _a, ctx) => {
        for (const _ of arrivals(d, card, ctx.cards ?? [])) {
          if (crossOutProduction(d.catalog, d.s, card)) log(d.s, `${cardName(d.catalog, d.s, card)} : 1 production rayée`);
        }
      },
    });
  },
  // Powerful Prince, Prince ________.
  "When played, gain any 2 resources.": gainOnPlay(2),
  "When played, gain any 3 resources.": gainOnPlay(3),
  // Robber Saboteur.
  "When played, cross out any 1 production on 1 building in play.": () => {
    const buildings = (d: Draft) => d.s.zones.play.filter((id) => isKind(d, id, "Building") && crossableIcons(d.catalog, d.s, id).length > 0);
    const kinds = (d: Draft, id: InstanceId) => [...new Set(crossableIcons(d.catalog, d.s, id).map((x) => x.resource))];
    return trigger({
      timing: "played",
      optional: false,
      when: (d) => buildings(d).length > 0,
      // Le bâtiment (touché sur le plateau), puis la ressource rayée s'il en produit plusieurs.
      ask: steps(
        (d) => askCards("Bâtiment dont 1 production est rayée", buildings(d), 1),
        (d, _card, a) => {
          const id = cardsOf(a[0])[0];
          const rs = id ? kinds(d, id) : [];
          return rs.length > 1 ? askResources("Quelle production rayer ?", rs, 1) : null;
        },
      ),
      run: (d, _card, a) => {
        const id = cardsOf(a[0])[0];
        const r = resourcesOf(a[1])[0] ?? (id ? kinds(d, id)[0] : undefined);
        if (id && r && crossOutIcon(d.catalog, d.s, id, r)) log(d.s, `${cardName(d.catalog, d.s, id)} : 1 ${icon(r)} rayée`);
      },
    });
  },
  // Rebellious Monk.
  "When played, blocks any 3 friendly cards.": () =>
    trigger({
      timing: "played",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card) && friendlyOthers(d, card).length > 0,
      ask: (d, card, a) => (a.length === 0 && friendlyOthers(d, card).length > 3 ? askCards("3 cartes amies bloquées", friendlyOthers(d, card), 3) : null),
      run: (d, card, a) => blockCards(d, card, a.length ? cardsOf(a[0]) : friendlyOthers(d, card).slice(0, 3)),
    }),
  // Rescuer.
  "When played, play 1 Prisoner from discard pile.": playOnPlay("Prisonnier à jouer depuis la défausse", isPrisoner),
  // Druid Camp, Druid Sanctuary, Secluded Forest.
  "When played, discard all cards that stay in play.": () => {
    const stays = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => staysInPlay(d, id));
    return trigger({
      timing: "played",
      optional: false,
      when: (d, card) => stays(d, card).length > 0,
      run: (d, card) => discardCards(d, stays(d, card)),
    });
  },
  "When played, discard 1 card that stays in play.": () => {
    const stays = (d: Draft, self: InstanceId) => otherInPlay(d, self, (id) => staysInPlay(d, id));
    return trigger({
      timing: "played",
      optional: false,
      when: (d, card) => stays(d, card).length > 0,
      ask: (d, card, a) => (a.length === 0 && stays(d, card).length > 1 ? askCards("Carte qui reste en jeu à défausser", stays(d, card), 1) : null),
      run: (d, card, a) => discardCards(d, a.length ? cardsOf(a[0]) : stays(d, card).slice(0, 1)),
    });
  },
  "When upgraded, add sticker 6 to 2 friendly cards in play.": () => {
    const targets = (d: Draft, self: InstanceId) => friendlyOthers(d, self).filter((id) => canAddResourceSticker(d.catalog, d.s, id));
    return trigger({
      timing: "upgraded",
      optional: false,
      when: (d, card) => targets(d, card).length > 0,
      ask: (d, card, a) => (a.length === 0 && targets(d, card).length > 2 ? askCards("2 cartes amies qui reçoivent le sticker 6", targets(d, card), 2) : null),
      run: (d, card, a) => {
        for (const id of a.length ? cardsOf(a[0]) : targets(d, card).slice(0, 2)) placeSticker(d, id, "6");
      },
    });
  },
  // Keeper of Secrets.
  "When played, discard all other cards in play, then {rotate}.": () =>
    trigger({
      timing: "played",
      optional: false,
      run: (d, card) => {
        discardCards(d, otherInPlay(d, card));
        turnCard(d, card, "rotate");
      },
    }),
  // The Chase : piste rouge (la 3e case la détruit).
  "End of Turn: Mark 1 red {mark}.": () =>
    trigger({
      timing: "endTurn",
      optional: false,
      when: (d, card) => d.s.zones.play.includes(card) && freeIn(d, card, "red"),
      run: (d, card) => void markNextIn(d, card, "red"),
    }),
};
