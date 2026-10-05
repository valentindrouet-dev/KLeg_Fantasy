import type { Orientation, ResourceId, Upgrade } from "../data/schema";
import { payPool } from "./passives";
import { activeStage, hasKeyword, instance, missingFor, personWeight } from "./state";
import type { Catalog, GameState, InstanceId } from "./types";

// Améliorations (spec 4.4) : coût de la boîte marron, flèche, carte défaussée, fin du tour.

/** ↓ = rotation 180° sur la même face ; → = retournement sur l'autre face, même rotation. */
export function applyArrow(o: Orientation, arrow: Upgrade["arrow"]): Orientation {
  if (arrow === "rotate") return { side: o.side, rotation: o.rotation === 0 ? 180 : 0 };
  return { side: o.side === "front" ? "back" : "front", rotation: o.rotation };
}

export type CardRequirement = { count: number; keyword: string };

const KEYWORDS: Record<string, string> = {
  person: "Person",
  persons: "Person",
  land: "Land",
  lands: "Land",
  building: "Building",
  buildings: "Building",
  seafaring: "Seafaring",
};

/**
 * Coût en cartes (« 2 Persons », « 2 Persons 2 Lands 2 Buildings ») : cartes en jeu à défausser
 * (docs/RULES_DECISIONS.md). `null` = coût d'une autre nature, non automatisé avant P3.
 */
export function parseOtherCost(text: string | undefined): CardRequirement[] | null {
  if (text === undefined) return [];
  const parts = [...text.trim().matchAll(/(\d+)\s+([A-Za-z]+)/g)];
  const consumed = parts.map((m) => m[0]).join(" ");
  if (consumed !== text.trim().replace(/\s+/g, " ")) return null;
  const out: CardRequirement[] = [];
  for (const m of parts) {
    const keyword = KEYWORDS[(m[2] ?? "").toLowerCase()];
    if (!keyword) return null;
    out.push({ count: Number(m[1]), keyword });
  }
  return out;
}

/**
 * Choix de cartes dont le poids total atteint `need`, sans carte de trop (en retirer une passerait sous `need`) :
 * « 2 Persons » = Miners seul, ou deux autres personnes.
 */
export function weightedPicks<T>(items: readonly T[], need: number, weight: (x: T) => number): T[][] {
  const out: T[][] = [];
  for (let k = 1; k <= need; k++) {
    for (const pick of combinations(items, k)) {
      const total = pick.reduce((n, x) => n + weight(x), 0);
      if (total >= need && pick.every((x) => total - weight(x) < need)) out.push(pick);
    }
  }
  return out;
}

export function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((first, i) => combinations(items.slice(i + 1), k - 1).map((rest) => [first, ...rest]));
}

/** Toutes les façons de payer un coût en cartes avec les autres cartes en jeu. */
export function cardCostOptions(
  catalog: Catalog,
  s: GameState,
  self: InstanceId,
  reqs: readonly CardRequirement[],
): InstanceId[][] {
  return reqs.reduce<InstanceId[][]>(
    (acc, req) =>
      acc.flatMap((chosen) => {
        const eligible = s.zones.play.filter(
          (id) => id !== self && !chosen.includes(id) && hasKeyword(catalog, s, id, req.keyword),
        );
        if (req.keyword !== "Person") return combinations(eligible, req.count).map((pick) => [...chosen, ...pick]);
        // Personnes : Miners compte pour 2 ; on garde les choix sans carte de trop.
        return weightedPicks(eligible, req.count, (id) => personWeight(catalog, s, id)).map((pick) => [...chosen, ...pick]);
      }),
    [[]],
  );
}

/** Coût en ressources d'une amélioration, sans les icônes rayées (Royal Visit, Bordering Lands). */
export function upgradeCost(catalog: Catalog, s: GameState, id: InstanceId, u: Upgrade): ResourceId[] {
  const stage = activeStage(catalog, s, id);
  const crossed = new Set(instance(s, id).crossedOutCosts ?? []);
  return u.cost.filter((_, i) => !crossed.has(`${stage?.id ?? 0}/${u.id}/${i}`));
}

export type UpgradeOption = {
  upgrade: Upgrade;
  affordable: boolean;
  missing: ResourceId[]; // ressources manquantes
  cardCost: CardRequirement[] | null; // null : coût non automatisé
  reason: string | null; // pourquoi l'amélioration est impossible, en français
};

/** Améliorations du stage actif, avec ce qui manque pour chacune (affichage « Il manque 1 bois »). */
export function upgradeOptions(catalog: Catalog, s: GameState, id: InstanceId): UpgradeOption[] {
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  return stage.upgrades.map((u): UpgradeOption => {
    const missing = missingFor(s, upgradeCost(catalog, s, id, u), payPool(catalog, s));
    const cardCost = parseOtherCost(u.otherCost);
    let reason: string | null = null;
    if (!s.zones.play.includes(id)) reason = "La carte n'est pas en jeu";
    else if (cardCost === null) reason = `Coût non automatisé : ${u.otherCost ?? ""}`;
    else if (missing.length) reason = `Il manque ${missing.map((r) => `{${r}}`).join("")}`;
    else if (cardCostOptions(catalog, s, id, cardCost).length === 0) reason = `Il faut aussi défausser : ${u.otherCost ?? ""}`;
    return { upgrade: u, affordable: reason === null, missing, cardCost, reason };
  });
}
