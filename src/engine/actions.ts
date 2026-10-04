import type { Effect, Stage, Upgrade } from "../data/schema";
import { enumerateAnswers, isValidAnswer, nextQuestion } from "./choice";
import { effectKey } from "./effects/registry";
import { isEffectExhausted } from "./exhausted";
import { substituteScript } from "./effects/substitutes";
import {
  advance,
  continueTrigger,
  endTurn,
  normalizeState,
  queueTriggers,
  resolveDiscoveryChoice,
  resolveParchment,
  resolveSide,
  runQueue,
} from "./flow";
import { queueScript } from "./ops";
import { payPool, restrictions } from "./passives";
import { availableExpansions, startExpansion } from "./campaign";
import { producedIcons, productionChoices, productionGroups } from "./production";
import {
  activeStage,
  activeStageOrThrow,
  cardName,
  destroy,
  discard,
  formatIcons,
  gain,
  instance,
  log,
  pay,
  template,
  zoneOf,
} from "./state";
import {
  IllegalActionError,
  type Action,
  type Answer,
  type Catalog,
  type Draft,
  type EffectImpl,
  type EffectParams,
  type GameState,
  type InstanceId,
} from "./types";
import { applyArrow, cardCostOptions, upgradeCost, upgradeOptions } from "./upgrade";
import { executeManual, isManualOpValid } from "./manual";

// Les 5 actions du tour (spec 4.4) et les réponses aux décisions en attente.
// `getLegalActions` est la seule source de vérité : `applyAction` refuse tout ce qui n'y figure pas.

type UsableEffect = { stage: Stage; effect: Effect; impl: EffectImpl };

/** Effets qu'une carte en jeu (ou permanente) peut utiliser comme action ; les passifs automatisés s'utilisent à volonté. */
export function usableEffects(catalog: Catalog, s: GameState, id: InstanceId): UsableEffect[] {
  if (!s.zones.play.includes(id) && !s.zones.permanent.includes(id)) return [];
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  const c = instance(s, id);
  return stage.effects.flatMap((effect) => {
    if (isEffectExhausted(catalog, s, id, stage.id, effect)) return [];
    const impl = catalog.effects.get(effectKey(c.templateId, stage.id, effect.id));
    return impl ? [{ stage, effect, impl }] : [];
  });
}

export function getLegalActions(catalog: Catalog, s: GameState): Action[] {
  if (s.phase === "gameOver") return availableExpansions(s).map((card) => ({ type: "startExpansion", card }));
  const p = s.pending;
  if (p) {
    switch (p.kind) {
      case "discoverChoice":
        return p.options.filter((id) => !p.picked.includes(id)).map((card) => ({ type: "chooseDiscovery", card }));
      case "chooseSide":
        return [
          { type: "chooseSide", side: "front" },
          { type: "chooseSide", side: "back" },
        ];
      case "parchment":
        return [{ type: "acknowledgeParchment" }];
      case "newCards":
        return [{ type: "acknowledgeDiscoveries" }];
      case "choice":
        return [
          ...enumerateAnswers(p.request).map((answer): Action => ({ type: "choose", answer })),
          ...(p.cancellable ? [{ type: "cancelChoice" } as const] : []),
        ];
    }
  }

  const actions: Action[] = [];
  const d: Draft = { catalog, s };
  const banned = restrictions(catalog, s);
  for (const card of s.zones.play) {
    const groups = productionGroups(catalog, s, card);
    if (groups.length) {
      for (const choices of productionChoices(groups)) actions.push({ type: "produce", card, choices });
    }
    if (!banned.noUpgrade) {
      for (const o of upgradeOptions(catalog, s, card)) {
        if (!o.affordable || !o.cardCost) continue;
        for (const discard of cardCostOptions(catalog, s, card, o.cardCost)) {
          actions.push({ type: "upgrade", card, upgrade: o.upgrade.id, discard });
        }
      }
    }
  }
  for (const card of [...s.zones.play, ...s.zones.permanent]) {
    for (const { effect, impl } of usableEffects(catalog, s, card)) {
      if (effect.type === "time" && banned.noTime) continue;
      for (const p of impl.params(d, card)) {
        actions.push({ type: "useEffect", card, effect: effect.id, targets: p.targets, option: p.option });
      }
    }
  }
  if (s.zones.deck.length > 0 && !banned.noAdvance) actions.push({ type: "advance" });
  actions.push({ type: "pass" });
  return actions;
}

/** Clé canonique d'une action (ordre des clés et des cibles indifférent). */
export function actionKey(a: Action): string {
  if (a.type === "manual") return JSON.stringify(["manual", Object.entries(a.op).sort(([x], [y]) => x.localeCompare(y))]);
  if (a.type === "choose") return JSON.stringify(["choose", a.answer]);
  const norm: Record<string, unknown> = { ...a };
  if ("targets" in a) norm.targets = [...a.targets].sort();
  if ("discard" in a) norm.discard = [...a.discard].sort();
  return JSON.stringify(Object.keys(norm).sort().map((k) => [k, norm[k]]));
}

export function isLegal(catalog: Catalog, s: GameState, a: Action): boolean {
  // Opérations « à la main » de la v0.17, retirées de l'interface : acceptées seulement pour rejouer
  // les parties enregistrées avec cette version (annulation, import).
  if (a.type === "manual") return isManualOpValid(catalog, s, a.op);
  // Réponse à une question : vérifiée contre la question (les réponses ne sont pas toutes énumérées).
  if (a.type === "choose") return s.phase === "playing" && s.pending?.kind === "choice" && isValidAnswer(s.pending.request, a.answer);
  if (a.type === "acknowledgeDiscoveries" && a.sides) {
    const p = s.pending;
    return (
      s.phase === "playing" &&
      p?.kind === "newCards" &&
      Object.entries(a.sides).every(([id, side]) => p.cards.includes(id) && (side === "front" || side === "back") && template(catalog, instance(s, id).templateId).chooseSideOnDiscover)
    );
  }
  const key = actionKey(a);
  if (getLegalActions(catalog, s).some((l) => actionKey(l) === key)) return true;
  // Parties enregistrées avant que l'effet prenne une cible (Priest, Cardinal, School…) : forme sans cible, puis questions.
  if (a.type === "useEffect" && a.targets.length === 0 && a.option === null && s.phase === "playing" && !s.pending) {
    const found = usableEffects(catalog, s, a.card).find((x) => x.effect.id === a.effect);
    return Boolean(found?.impl.legacyAsk && found.impl.params({ catalog, s }, a.card).length > 0);
  }
  return false;
}

/** Applique une action légale et renvoie le nouvel état (l'état reçu n'est jamais modifié). */
export function applyAction(catalog: Catalog, state: GameState, action: Action): GameState {
  const d: Draft = { catalog, s: structuredClone(state) };
  normalizeState(d.s);
  if (!isLegal(catalog, d.s, action)) {
    throw new IllegalActionError(`Action illégale : ${JSON.stringify(action)}`);
  }
  d.s.lostResources = {};
  execute(d, action);
  runQueue(d);
  return d.s;
}

/** La carte se défausse pour son action (production, effet) ; Impregnable Fortress peut défausser 2 murs à la place. */
function discardSelf(d: Draft, card: InstanceId): void {
  const sub = substituteScript(d, card);
  if (sub) {
    queueScript(d, card, sub);
    return;
  }
  discard(d, card);
}

/** Termine un effet utilisé comme action : coût lié au type, puis corps de l'effet (spec 5.2). */
function finishEffect(d: Draft, card: InstanceId, effectId: string, p: EffectParams): void {
  const { catalog, s } = d;
  const found = usableEffects(catalog, s, card).find((x) => x.effect.id === effectId);
  if (!found) throw new IllegalActionError(`Effet indisponible : ${effectId}`);
  const { stage, effect, impl } = found;
  log(s, `${cardName(catalog, s, card)} : ${effect.text}`);
  // Fin du tour mise en file d'abord : ce que l'effet ajoute à la file passe avant.
  if (effect.type === "time") endTurn(d);
  if (effect.oneTime) instance(s, card).crossedOutEffects.push(`${stage.id}/${effect.id}`);
  const zone = zoneOf(s, card);
  // Corps de l'effet d'abord, la carte encore en jeu (« including this ») ; puis le coût lié au type, sauf si
  // l'effet a déjà déplacé la carte (tournée et défaussée, remise dans la boîte…).
  impl.apply(d, card, p);
  if (zoneOf(s, card) !== zone) return;
  if (effect.type === "activated" || effect.type === "time") discardSelf(d, card);
  if (effect.type === "destroy") destroy(d, card);
}

function execute(d: Draft, a: Action): void {
  const { catalog, s } = d;
  switch (a.type) {
    case "produce": {
      const icons = producedIcons(productionGroups(catalog, s, a.card), a.choices);
      log(s, `${cardName(catalog, s, a.card)} produit ${formatIcons(icons)}`);
      queueTriggers(d, "produced", [a.card]);
      discardSelf(d, a.card);
      gain(s, icons);
      return;
    }
    case "upgrade": {
      const stage = activeStageOrThrow(catalog, s, a.card);
      const u = stage.upgrades.find((x) => x.id === a.upgrade);
      if (!u) throw new IllegalActionError(`Amélioration inconnue : ${a.upgrade}`);
      const before = cardName(catalog, s, a.card);
      pay(s, upgradeCost(catalog, s, a.card, u), payPool(catalog, s));
      for (const id of a.discard) discard(d, id);
      endTurn(d); // règle d'or 4, après les effets « when upgraded »
      upgradeCard(d, a.card, u);
      log(s, `Amélioration : ${before} → ${cardName(catalog, s, a.card)}, fin du tour`);
      return;
    }
    case "useEffect": {
      const found = usableEffects(catalog, s, a.card).find((x) => x.effect.id === a.effect);
      if (!found) throw new IllegalActionError(`Effet indisponible : ${a.effect}`);
      // Effet à cible choisie sur le plateau (Priest : la carte à améliorer) : pas de question.
      const ask = a.targets.length || a.option !== null ? undefined : found.impl.ask;
      if (ask) {
        const answers: Answer[] = [];
        const request = nextQuestion((x) => ask(d, a.card, x), answers);
        if (request) {
          const key = effectKey(instance(s, a.card).templateId, found.stage.id, found.effect.id);
          s.pending = { kind: "choice", source: a.card, script: key, mode: "effect", effect: a.effect, answers, request, cancellable: true, ctx: {} };
          return;
        }
        finishEffect(d, a.card, a.effect, { targets: a.targets, option: a.option, answers });
        return;
      }
      finishEffect(d, a.card, a.effect, { targets: a.targets, option: a.option });
      return;
    }
    case "choose": {
      const p = s.pending;
      if (p?.kind !== "choice") throw new IllegalActionError("Aucun choix en cours");
      const answers = [...p.answers, a.answer];
      s.pending = null;
      if (p.mode === "effect") {
        const ask = catalog.effects.get(p.script)?.ask;
        const next = ask ? nextQuestion((x) => ask(d, p.source, x), answers) : null;
        if (next) s.pending = { ...p, answers, request: next };
        else finishEffect(d, p.source, p.effect, { targets: [], option: null, answers });
        return;
      }
      continueTrigger(d, p.source, p.script, answers, p.ctx);
      return;
    }
    case "cancelChoice":
      s.pending = null;
      return;
    case "advance":
      advance(d);
      return;
    case "pass":
      log(s, "Passer");
      endTurn(d);
      return;
    case "chooseDiscovery":
      resolveDiscoveryChoice(d, a.card);
      return;
    case "chooseSide": {
      if (s.pending?.kind !== "chooseSide") throw new IllegalActionError("Aucun choix de face en cours");
      resolveSide(d, s.pending.card, a.side);
      return;
    }
    case "acknowledgeParchment": {
      if (s.pending?.kind !== "parchment") throw new IllegalActionError("Aucun parchemin en cours");
      resolveParchment(d, s.pending.card);
      return;
    }
    case "manual":
      executeManual(d, a.op);
      return;
    case "acknowledgeDiscoveries": {
      // Cartes à flèches rouges : la face choisie dans la fenêtre (demande du 2026-10-04).
      const shown = s.pending?.kind === "newCards" ? s.pending.cards : [];
      for (const [id, side] of Object.entries(a.sides ?? {})) {
        if (!shown.includes(id) || !template(catalog, instance(s, id).templateId).chooseSideOnDiscover) continue;
        instance(s, id).orientation = { side, rotation: 0 };
        if (side === "back") log(s, `${cardName(catalog, s, id)} : verso choisi`);
      }
      s.pending = null;
      return;
    }
    case "startExpansion":
      startExpansion(d, a.card);
      return;
  }
}

/** Applique une amélioration (orientation, défausse) et ses effets « when you upgrade this ». Ne finit pas le tour. */
export function upgradeCard(d: Draft, card: InstanceId, u: Upgrade): void {
  queueTriggers(d, "upgraded", [card]);
  const c = instance(d.s, card);
  c.orientation = applyArrow(c.orientation, u.arrow);
  discard(d, card); // règle d'or 3
}
