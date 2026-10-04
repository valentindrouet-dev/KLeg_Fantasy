import type { ProductionGroup, ResourceId } from "../data/schema";
import { applyAction, getLegalActions, isLegal, usableEffects } from "./actions";
import { producedIcons, productionChoices, productionGroups } from "./production";
import { activeStage, countIcons } from "./state";
import type { Action, Catalog, GameState, InstanceId } from "./types";
import { combinations, upgradeCost } from "./upgrade";

// Paiement avec des cartes « engagées » (interface) : le joueur marque les cartes dont il compte utiliser
// la ressource ; elles ne produisent (et ne sont défaussées) qu'au moment de payer. Produire à n'importe quel
// moment du tour est permis par les règles, donc ce plan ne fait que choisir quand produire.

/**
 * Effet « Gain … au choix » d'une carte en jeu sans production (Servant, Investor…) : utilisable comme une production
 * (demande du 2026-10-04). Effet activé seulement (un effet {destroy} détruirait la carte).
 */
export function gainEffectOf(catalog: Catalog, s: GameState, id: InstanceId): { effect: string; options: ResourceId[][]; cost: readonly ResourceId[] } | null {
  if (!s.zones.play.includes(id) || productionGroups(catalog, s, id).length > 0) return null;
  for (const { effect, impl } of usableEffects(catalog, s, id)) {
    if (effect.type !== "activated" || !impl.gains) continue;
    const options = impl.gains({ catalog, s });
    // Coût de l'échange (Bazaar : 1 {coin}), payé au moment de l'utiliser.
    if (options.length) return { effect: effect.id, options, cost: (impl.cost ?? []) as readonly ResourceId[] };
  }
  return null;
}

/**
 * Ce qu'une carte engagée peut fournir, en groupes « au choix » : sa production, sinon son effet de gain (une icône
 * par groupe ; « any 2 » = deux groupes de toutes les ressources).
 */
export function sourceGroups(catalog: Catalog, s: GameState, id: InstanceId): ProductionGroup[] {
  const groups = productionGroups(catalog, s, id);
  if (groups.length) return groups;
  const gain = gainEffectOf(catalog, s, id);
  if (!gain) return [];
  const size = gain.options[0]?.length ?? 0;
  if (gain.options.every((o) => o.length === 1)) return [{ id: "gain", options: gain.options }];
  return Array.from({ length: size }, (_, i) => ({ id: `gain${i}`, options: catalog.resources.map((r) => [r]) }));
}

/** Action qui tire d'une carte engagée ces choix (un indice par groupe) : production, ou effet de gain. */
function sourceAction(catalog: Catalog, s: GameState, card: InstanceId, choices: number[]): Action | null {
  if (productionGroups(catalog, s, card).length) return { type: "produce", card, choices };
  const gain = gainEffectOf(catalog, s, card);
  if (!gain) return null;
  const icons = producedIcons(sourceGroups(catalog, s, card), choices);
  const key = [...icons].sort().join(",");
  const option = gain.options.findIndex((o) => [...o].sort().join(",") === key);
  return option < 0 ? null : { type: "useEffect", card, effect: gain.effect, targets: [], option };
}

/** Ressources dépensées par une action (coût d'amélioration, coût d'un effet), ou null. */
export function actionCost(catalog: Catalog, s: GameState, a: Action): readonly ResourceId[] | null {
  if (a.type === "upgrade") {
    const u = activeStage(catalog, s, a.card)?.upgrades.find((x) => x.id === a.upgrade);
    return u ? upgradeCost(catalog, s, a.card, u) : null;
  }
  if (a.type === "useEffect") {
    const impl = usableEffects(catalog, s, a.card).find((e) => e.effect.id === a.effect)?.impl;
    return impl?.costOf?.({ catalog, s }, a.card, { targets: a.targets, option: a.option }) ?? impl?.cost ?? null;
  }
  return null;
}

function covers(have: Record<string, number>, cost: readonly ResourceId[]): boolean {
  return Object.entries(countIcons(cost)).every(([r, n]) => (have[r] ?? 0) >= n);
}

function surplus(have: Record<string, number>, cost: readonly ResourceId[]): number {
  const need = cost.length;
  return Object.values(have).reduce((a, b) => a + b, 0) - need;
}

/**
 * Actions à jouer pour réaliser `action` : les productions des cartes engagées nécessaires (le moins de cartes
 * possible, puis le moins de ressources gaspillées), suivies de l'action. null si c'est impossible.
 */
export function planWithEngaged(
  catalog: Catalog,
  s: GameState,
  action: Action,
  engaged: readonly InstanceId[],
): Action[] | null {
  if (isLegal(catalog, s, action)) return [action];
  const cost = actionCost(catalog, s, action);
  if (!cost) return null;
  const excluded = new Set<InstanceId>([
    ...("card" in action ? [action.card] : []),
    ...("targets" in action ? action.targets : []),
    ...("discard" in action ? action.discard : []),
  ]);
  const candidates = engaged.filter(
    (id) => s.zones.play.includes(id) && !excluded.has(id) && sourceGroups(catalog, s, id).length > 0,
  );
  // Export : toutes les cartes engagées qui produisent une ressource du coût produisent (tout est dépensé).
  const impl = action.type === "useEffect" ? usableEffects(catalog, s, action.card).find((e) => e.effect.id === action.effect)?.impl : undefined;
  const all = impl?.useAllEngaged
    ? candidates.filter((id) => sourceGroups(catalog, s, id).some((g) => g.options.some((o) => o.some((r) => cost.includes(r)))))
    : [];
  // Meilleure production (le moins de ressources perdues) parmi ces groupes de cartes, vérifiée sur le vrai moteur.
  const tryGroups = (groups: readonly (readonly InstanceId[])[]): Action[] | null => {
    let best: { produce: Action[]; waste: number } | null = null;
    for (const subset of groups) {
      // La production d'une carte peut dépendre des autres cartes en jeu (Cathedral : +1 {coin} par personne) :
      // on produit carte par carte, dans chaque ordre possible, en recalculant à chaque fois.
      // Trop de cartes pour tout essayer : les échanges (Bazaar) en dernier, après les cartes qui produisent leur coût.
      const exchangesLast = [...subset].sort((a, b) => Number((gainEffectOf(catalog, s, a)?.cost.length ?? 0) > 0) - Number((gainEffectOf(catalog, s, b)?.cost.length ?? 0) > 0));
      for (const order of subset.length <= 4 ? permutations(subset) : [exchangesLast]) {
        for (const produce of producePlans(catalog, s, order)) {
          const sim = simulate(catalog, s, produce);
          if (!sim || !covers(sim.resources, cost)) continue;
          const waste = surplus(sim.resources, cost);
          if (best && best.waste <= waste) continue;
          if (!isLegal(catalog, sim, action)) continue;
          best = { produce, waste };
        }
      }
    }
    if (!best) return null;
    try {
      let next = s;
      for (const p of best.produce) next = applyAction(catalog, next, p);
      return isLegal(catalog, next, action) ? [...best.produce, action] : null;
    } catch {
      return null;
    }
  };
  if (all.length) {
    const plan = tryGroups([all]);
    if (plan) return plan;
  }
  for (let size = 1; size <= candidates.length; size++) {
    const plan = tryGroups(combinations(candidates, size));
    if (plan) return plan;
  }
  return null;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));
}

/** État allégé après ces productions (carte défaussée, ressources gagnées), ou null si l'une est impossible. */
function simulate(catalog: Catalog, s: GameState, produce: Action[]): GameState | null {
  let sim: GameState = { ...s, zones: { ...s.zones, play: [...s.zones.play], discard: [...s.zones.discard] }, resources: { ...s.resources } };
  for (const p of produce) {
    if ((p.type !== "produce" && p.type !== "useEffect") || !sim.zones.play.includes(p.card)) return null;
    let icons: ResourceId[];
    if (p.type === "produce") {
      const groups = productionGroups(catalog, sim, p.card);
      if (p.choices.length !== groups.length) return null;
      icons = producedIcons(groups, p.choices);
    } else {
      const gain = gainEffectOf(catalog, sim, p.card);
      icons = gain?.options[p.option ?? -1] ?? [];
      if (!gain || !icons.length) return null;
      // Échange (Bazaar) : la dépense doit être disponible à ce moment-là.
      const left = { ...sim.resources };
      for (const r of gain.cost) {
        if ((left[r] ?? 0) <= 0) return null;
        left[r] = (left[r] ?? 0) - 1;
      }
      sim = { ...sim, resources: left };
    }
    const resources = { ...sim.resources };
    for (const r of icons) resources[r] = (resources[r] ?? 0) + 1;
    sim = { ...sim, zones: { ...sim.zones, play: sim.zones.play.filter((id) => id !== p.card), discard: [...sim.zones.discard, p.card] }, resources };
  }
  return sim;
}

/** Toutes les productions possibles des cartes dans cet ordre (choix des « / » recalculés après chaque carte). */
function producePlans(catalog: Catalog, s: GameState, order: readonly InstanceId[]): Action[][] {
  const out: Action[][] = [];
  const walk = (i: number, done: Action[]): void => {
    if (out.length >= 200) return;
    const card = order[i];
    if (card === undefined) {
      out.push(done);
      return;
    }
    const sim = simulate(catalog, s, done);
    if (!sim) return;
    for (const choices of productionChoices(sourceGroups(catalog, sim, card))) {
      const step = sourceAction(catalog, sim, card, choices);
      if (step) walk(i + 1, [...done, step]);
    }
  };
  walk(0, []);
  return out;
}

/**
 * Actions envisageables pour une carte en jeu en supposant les ressources disponibles (améliorations, effets),
 * à vérifier ensuite avec planWithEngaged. La production n'y figure pas : l'interface l'exprime par l'engagement.
 */
export function candidateActions(catalog: Catalog, s: GameState, card: InstanceId): Action[] {
  const rich: GameState = { ...s, resources: Object.fromEntries(catalog.resources.map((r) => [r, 99])) };
  // L'effet de gain au choix (Servant…) s'exprime, comme la production, par l'engagement de la carte.
  const gain = gainEffectOf(catalog, s, card)?.effect;
  return getLegalActions(catalog, rich).filter((a) => "card" in a && a.card === card && a.type !== "produce" && !(a.type === "useEffect" && a.effect === gain));
}

/**
 * Cartes en jeu qui peuvent aider à payer `action` (effet ou amélioration touché sans assez de ressources) :
 * elles produisent une ressource du coût et ne sont ni la carte de l'action, ni une de ses cibles, ni déjà engagées.
 */
export function paymentCandidates(catalog: Catalog, s: GameState, action: Action, engaged: readonly InstanceId[]): InstanceId[] {
  const cost = actionCost(catalog, s, action);
  if (!cost?.length) return [];
  const excluded = new Set<InstanceId>([
    ...engaged,
    ...("card" in action ? [action.card] : []),
    ...("targets" in action ? action.targets : []),
    ...("discard" in action ? action.discard : []),
  ]);
  return s.zones.play.filter(
    (id) => !excluded.has(id) && sourceGroups(catalog, s, id).some((g) => g.options.some((o) => o.some((r) => cost.includes(r)))),
  );
}

/** Ressources que représentent les cartes engagées (une option par groupe ; les « / » sont listés à part). */
export function engagedPotential(
  catalog: Catalog,
  s: GameState,
  engaged: readonly InstanceId[],
): { fixed: Record<string, number>; choices: ResourceId[][][] } {
  const fixed: Record<string, number> = {};
  const choices: ResourceId[][][] = [];
  for (const id of engaged) {
    if (!s.zones.play.includes(id)) continue;
    // Échange engagé : sa dépense est retirée de ce qui est disponible.
    for (const r of gainEffectOf(catalog, s, id)?.cost ?? []) fixed[r] = (fixed[r] ?? 0) - 1;
    for (const g of sourceGroups(catalog, s, id)) {
      if (g.options.length === 1) for (const r of g.options[0] ?? []) fixed[r] = (fixed[r] ?? 0) + 1;
      else choices.push(g.options);
    }
  }
  return { fixed, choices };
}
