import type { Effect, Stage } from "../data/schema";
import { effectKey } from "./effects/registry";
import { advance, endTurn, resolveDiscoveryChoice, resolveParchment, resolveSide, runQueue } from "./flow";
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
} from "./state";
import {
  IllegalActionError,
  type Action,
  type Catalog,
  type Draft,
  type EffectImpl,
  type GameState,
  type InstanceId,
} from "./types";
import { applyArrow, cardCostOptions, upgradeOptions } from "./upgrade";
import { executeManual, isManualOpValid, manualEffects } from "./manual";

// Les 5 actions du tour (spec 4.4) et les réponses aux décisions en attente.
// `getLegalActions` est la seule source de vérité : `applyAction` refuse tout ce qui n'y figure pas.

type UsableEffect = { stage: Stage; effect: Effect; impl: EffectImpl };

/** Effets qu'une carte en jeu peut utiliser comme action (types activated, destroy, time). */
export function usableEffects(catalog: Catalog, s: GameState, id: InstanceId): UsableEffect[] {
  if (!s.zones.play.includes(id)) return [];
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  const c = instance(s, id);
  return stage.effects.flatMap((effect) => {
    if (c.crossedOutEffects.includes(`${stage.id}/${effect.id}`)) return [];
    const impl = catalog.effects.get(effectKey(c.templateId, stage.id, effect.id));
    return impl ? [{ stage, effect, impl }] : [];
  });
}

export function getLegalActions(catalog: Catalog, s: GameState): Action[] {
  if (s.phase === "gameOver") return [];
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
    }
  }

  const actions: Action[] = [];
  const d: Draft = { catalog, s };
  for (const card of s.zones.play) {
    const groups = productionGroups(catalog, s, card);
    if (groups.length) {
      for (const choices of productionChoices(groups)) actions.push({ type: "produce", card, choices });
    }
    for (const o of upgradeOptions(catalog, s, card)) {
      if (!o.affordable || !o.cardCost) continue;
      for (const discard of cardCostOptions(catalog, s, card, o.cardCost)) {
        actions.push({ type: "upgrade", card, upgrade: o.upgrade.id, discard });
      }
    }
    for (const { effect, impl } of usableEffects(catalog, s, card)) {
      for (const p of impl.params(d, card)) {
        actions.push({ type: "useEffect", card, effect: effect.id, targets: p.targets, option: p.option });
      }
    }
    // Effets non automatisés : on paie le coût du type (défausser, détruire, fin du tour), le reste à la main.
    for (const effect of manualEffects(catalog, s, card)) actions.push({ type: "manual", op: { kind: "effect", card, effect } });
  }
  if (s.zones.deck.length > 0) actions.push({ type: "advance" });
  actions.push({ type: "pass" });
  return actions;
}

/** Clé canonique d'une action (ordre des clés et des cibles indifférent). */
export function actionKey(a: Action): string {
  if (a.type === "manual") return JSON.stringify(["manual", Object.entries(a.op).sort(([x], [y]) => x.localeCompare(y))]);
  const norm: Record<string, unknown> = { ...a };
  if ("targets" in a) norm.targets = [...a.targets].sort();
  if ("discard" in a) norm.discard = [...a.discard].sort();
  return JSON.stringify(Object.keys(norm).sort().map((k) => [k, norm[k]]));
}

export function isLegal(catalog: Catalog, s: GameState, a: Action): boolean {
  // Opérations à la main en nombre illimité (ressources, déplacements…) : validées sans être énumérées.
  if (a.type === "manual" && a.op.kind !== "effect") return isManualOpValid(catalog, s, a.op);
  const key = actionKey(a);
  return getLegalActions(catalog, s).some((l) => actionKey(l) === key);
}

/** Applique une action légale et renvoie le nouvel état (l'état reçu n'est jamais modifié). */
export function applyAction(catalog: Catalog, state: GameState, action: Action): GameState {
  if (!isLegal(catalog, state, action)) {
    throw new IllegalActionError(`Action illégale : ${JSON.stringify(action)}`);
  }
  const d: Draft = { catalog, s: structuredClone(state) };
  d.s.lostResources = {};
  execute(d, action);
  runQueue(d);
  return d.s;
}

function execute(d: Draft, a: Action): void {
  const { catalog, s } = d;
  switch (a.type) {
    case "produce": {
      const icons = producedIcons(productionGroups(catalog, s, a.card), a.choices);
      log(s, `${cardName(catalog, s, a.card)} produit ${formatIcons(icons)}`);
      discard(d, a.card);
      gain(s, icons);
      return;
    }
    case "upgrade": {
      const stage = activeStageOrThrow(catalog, s, a.card);
      const u = stage.upgrades.find((x) => x.id === a.upgrade);
      if (!u) throw new IllegalActionError(`Amélioration inconnue : ${a.upgrade}`);
      const before = cardName(catalog, s, a.card);
      pay(s, u.cost);
      for (const id of a.discard) discard(d, id);
      const c = instance(s, a.card);
      c.orientation = applyArrow(c.orientation, u.arrow);
      discard(d, a.card); // règle d'or 3
      log(s, `Amélioration : ${before} → ${cardName(catalog, s, a.card)}, fin du tour`);
      endTurn(d); // règle d'or 4
      return;
    }
    case "useEffect": {
      const found = usableEffects(catalog, s, a.card).find((x) => x.effect.id === a.effect);
      if (!found) throw new IllegalActionError(`Effet indisponible : ${a.effect}`);
      const { stage, effect, impl } = found;
      log(s, `${cardName(catalog, s, a.card)} : ${effect.text}`);
      if (effect.type === "activated" || effect.type === "time") discard(d, a.card);
      if (effect.type === "destroy") destroy(d, a.card);
      impl.apply(d, a.card, { targets: a.targets, option: a.option });
      if (effect.oneTime) instance(s, a.card).crossedOutEffects.push(`${stage.id}/${effect.id}`);
      if (effect.type === "time") endTurn(d);
      return;
    }
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
  }
}
