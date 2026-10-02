import type { ResourceId } from "../data/schema";
import { applyAction, getLegalActions, isLegal, usableEffects } from "./actions";
import { producedIcons, productionChoices, productionGroups } from "./production";
import { activeStage, countIcons } from "./state";
import type { Action, Catalog, GameState, InstanceId } from "./types";
import { combinations, upgradeCost } from "./upgrade";

// Paiement avec des cartes « engagées » (interface) : le joueur marque les cartes dont il compte utiliser
// la ressource ; elles ne produisent (et ne sont défaussées) qu'au moment de payer. Produire à n'importe quel
// moment du tour est permis par les règles, donc ce plan ne fait que choisir quand produire.

/** Ressources dépensées par une action (coût d'amélioration, coût d'un effet), ou null. */
export function actionCost(catalog: Catalog, s: GameState, a: Action): readonly ResourceId[] | null {
  if (a.type === "upgrade") {
    const u = activeStage(catalog, s, a.card)?.upgrades.find((x) => x.id === a.upgrade);
    return u ? upgradeCost(catalog, s, a.card, u) : null;
  }
  if (a.type === "useEffect") {
    const impl = usableEffects(catalog, s, a.card).find((e) => e.effect.id === a.effect)?.impl;
    return impl?.costOf?.({ catalog, s }, a.card) ?? impl?.cost ?? null;
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
    (id) => s.zones.play.includes(id) && !excluded.has(id) && productionGroups(catalog, s, id).length > 0,
  );
  for (let size = 1; size <= candidates.length; size++) {
    let best: { produce: Action[]; waste: number } | null = null;
    for (const subset of combinations(candidates, size)) {
      const options = subset.map((id) => productionChoices(productionGroups(catalog, s, id)));
      const combos = options.reduce<number[][][]>((acc, opts) => acc.flatMap((prefix) => opts.map((o) => [...prefix, o])), [[]]);
      for (const choices of combos) {
        const have: Record<string, number> = { ...s.resources };
        subset.forEach((id, i) => {
          for (const r of producedIcons(productionGroups(catalog, s, id), choices[i] ?? [])) have[r] = (have[r] ?? 0) + 1;
        });
        if (!covers(have, cost)) continue;
        const waste = surplus(have, cost);
        if (best && best.waste <= waste) continue;
        best = { produce: subset.map((card, i) => ({ type: "produce", card, choices: choices[i] ?? [] })), waste };
      }
    }
    if (best) {
      let next = s;
      for (const p of best.produce) next = applyAction(catalog, next, p);
      if (isLegal(catalog, next, action)) return [...best.produce, action];
    }
  }
  return null;
}

/**
 * Actions envisageables pour une carte en jeu en supposant les ressources disponibles (améliorations, effets),
 * à vérifier ensuite avec planWithEngaged. La production n'y figure pas : l'interface l'exprime par l'engagement.
 */
export function candidateActions(catalog: Catalog, s: GameState, card: InstanceId): Action[] {
  const rich: GameState = { ...s, resources: Object.fromEntries(catalog.resources.map((r) => [r, 99])) };
  return getLegalActions(catalog, rich).filter((a) => "card" in a && a.card === card && a.type !== "produce");
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
    (id) => !excluded.has(id) && productionGroups(catalog, s, id).some((g) => g.options.some((o) => o.some((r) => cost.includes(r)))),
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
    for (const g of productionGroups(catalog, s, id)) {
      if (g.options.length === 1) for (const r of g.options[0] ?? []) fixed[r] = (fixed[r] ?? 0) + 1;
      else choices.push(g.options);
    }
  }
  return { fixed, choices };
}
