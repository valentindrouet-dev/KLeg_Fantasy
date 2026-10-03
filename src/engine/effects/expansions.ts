import { askCards, askOption, cardsOf, optionOf } from "../choice";
import { discardFromDeck } from "../flow";
import { discardCards, effectGain, friendly, isPerson, keepInPlay, markBox, payD, trackComplete, unmarkedBoxes } from "../ops";
import { activeStage, cardName, instance, log } from "../state";
import type { Answer, ChoiceRequest, Draft, EffectImpl, InstanceId, TriggerCtx, TriggerImpl } from "../types";
import { NO_PARAMS } from "./registry";

// Effets des mini-extensions 136, 137, 138 pendant leur manche (spec 4.7). Le passage d'une étape à l'autre en fin de
// manche est dans campaign.ts ; les règles passives (Prosperity, Surplus, Border Dispute) dans passives.ts et flow.ts.

const T = {
  hoarding: "Play 1 round where you may make 1 card stay in play each turn. Then {flip}.",
  uprising: "Play 1 round where you must mark 1 {mark} each time a person is played when there is already a person in play. Then {rotate}.",
  waterMill: "Play 1 round where you may gain {coin}{coin}{coin} once per turn. Then {rotate}.",
  espionage: "When a person is played, either mark 1 {mark} or discard 2 friendly cards. If complete, discard all cards in your deck.",
  resistance:
    "Play 1 round where you can spend any amount of {sword} and keep track of how many you have spent. After the round, write the amount (max 100) in sticker 16 and add that sticker to 1 land. Then destroy this.",
} as const;

const isPermanentHere = (d: Draft, card: InstanceId): boolean => d.s.zones.permanent.includes(card);
const turnStamp = (d: Draft): number => d.s.round * 1000 + d.s.turn;

/** Personnes arrivées en jeu dans ce déclenchement. */
const playedPersons = (d: Draft, ctx: TriggerCtx): InstanceId[] => (ctx.cards ?? []).filter((id) => d.s.zones.play.includes(id) && isPerson(d, id));

function markNextBox(d: Draft, card: InstanceId): boolean {
  const next = unmarkedBoxes(d, card)[0];
  if (!next) return false;
  markBox(d, card, next.stage, next.id);
  return true;
}

/** Épées dépensées sur Resistance (compteur du stage 4). */
function depositSwords(d: Draft, card: InstanceId, n: number): void {
  const stage = activeStage(d.catalog, d.s, card)?.id;
  if (stage === undefined || n <= 0) return;
  payD(d, Array.from({ length: n }, () => "sword"));
  const c = instance(d.s, card);
  const key = String(stage);
  c.tallies = { ...(c.tallies ?? {}), [key]: (c.tallies?.[key] ?? 0) + n };
  log(d.s, `${cardName(d.catalog, d.s, card)} : ${n} {sword} dépensée(s), total ${c.tallies[key]}`);
}

export const EXPANSION_EFFECTS: Record<string, () => EffectImpl> = {
  // The Water Mill : 3 {coin} une fois par tour (ne finit pas le tour).
  [T.waterMill]: () => ({
    params: (d, card) => (isPermanentHere(d, card) && instance(d.s, card).tallies?.["mill"] !== turnStamp(d) ? [NO_PARAMS] : []),
    apply: (d, card) => {
      const c = instance(d.s, card);
      c.tallies = { ...(c.tallies ?? {}), mill: turnStamp(d) };
      effectGain(d, ["coin", "coin", "coin"]);
    },
  }),
  // Resistance : toutes les épées du moment, comme Export pour les marchandises.
  [T.resistance]: () => ({
    params: (d, card) => (isPermanentHere(d, card) && (d.s.resources.sword ?? 0) > 0 ? [NO_PARAMS] : []),
    apply: (d, card) => depositSwords(d, card, d.s.resources.sword ?? 0),
    cost: ["sword"],
    useAllEngaged: true,
  }),
};

/** Espionage : pour chaque personne jouée, cocher 1 case ou défausser 2 cartes amies ; la question suivante, ou le plan. */
function espionagePlan(d: Draft, card: InstanceId, a: Answer[], ctx: TriggerCtx): { req: ChoiceRequest | null; plan: ("mark" | InstanceId[])[] } {
  const plan: ("mark" | InstanceId[])[] = [];
  let k = 0;
  let marks = unmarkedBoxes(d, card).length;
  const gone = new Set<InstanceId>();
  for (const person of playedPersons(d, ctx)) {
    void person;
    const friends = d.s.zones.play.filter((id) => friendly(d, id) && !gone.has(id));
    const canMark = marks > 0;
    const canDiscard = friends.length >= 2;
    if (!canMark && !canDiscard) continue;
    let choice = canMark ? 0 : 1;
    if (canMark && canDiscard) {
      if (k >= a.length) return { req: askOption("Espionage : une personne est jouée", ["Cocher 1 case", "Défausser 2 cartes amies"]), plan };
      choice = optionOf(a[k++]);
    }
    if (choice === 0) {
      plan.push("mark");
      marks -= 1;
    } else {
      if (k >= a.length) return { req: askCards("2 cartes amies à défausser", friends, 2), plan };
      const picked = cardsOf(a[k++]);
      for (const id of picked) gone.add(id);
      plan.push(picked);
    }
  }
  return { req: null, plan };
}

export const EXPANSION_TRIGGERS: Record<string, () => TriggerImpl> = {
  // Hoarding : à chaque fin de tour, on peut garder 1 carte en jeu.
  [T.hoarding]: () => ({
    timing: "endTurn",
    optional: true,
    prompt: "Hoarding : garder 1 carte en jeu ?",
    when: (d, card) => isPermanentHere(d, card) && d.s.zones.play.length > 0,
    ask: (d, _card, a) => (a.length === 0 ? askCards("Carte qui reste en jeu", [...d.s.zones.play], 1) : null),
    run: (d, _card, a) => keepInPlay(d, cardsOf(a[0])),
  }),
  // Uprising : chaque personne jouée alors qu'une personne est déjà en jeu coche 1 case.
  [T.uprising]: () => ({
    timing: "otherPlayed",
    optional: false,
    when: (d, card, ctx) => isPermanentHere(d, card) && playedPersons(d, ctx).length > 0,
    run: (d, card, _a, ctx) => {
      const arrived = playedPersons(d, ctx);
      let before = d.s.zones.play.filter((id) => isPerson(d, id) && !arrived.includes(id)).length;
      for (const id of arrived) {
        void id;
        if (before > 0) markNextBox(d, card);
        before += 1;
      }
    },
  }),
  [T.espionage]: () => ({
    timing: "otherPlayed",
    optional: false,
    when: (d, card, ctx) => isPermanentHere(d, card) && playedPersons(d, ctx).length > 0,
    ask: (d, card, a, ctx) => espionagePlan(d, card, a, ctx).req,
    run: (d, card, a, ctx) => {
      for (const step of espionagePlan(d, card, a, ctx).plan) {
        if (step === "mark") markNextBox(d, card);
        else discardCards(d, step);
      }
      const stage = activeStage(d.catalog, d.s, card)?.id;
      if (stage !== undefined && trackComplete(d, card, stage) && d.s.zones.deck.length > 0) {
        log(d.s, "Espionage complet : tout le deck est défaussé");
        discardFromDeck(d, d.s.zones.deck.length);
      }
    },
  }),
  // Resistance : les épées restantes y sont dépensées en fin de tour plutôt que perdues (comme Export).
  [T.resistance]: () => ({
    timing: "endTurn",
    optional: false,
    when: (d, card) => isPermanentHere(d, card) && (d.s.resources.sword ?? 0) > 0,
    run: (d, card) => depositSwords(d, card, d.s.resources.sword ?? 0),
  }),
};
