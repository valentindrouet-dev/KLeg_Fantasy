import type { ResourceId, StageId } from "../../data/schema";
import { canPay, gain, pay } from "../state";
import type { Draft, EffectImpl, EffectParams } from "../types";

// Registre des effets automatisés. En P1 : effets des cartes 1 à 10, écrits à la main.
// Le DSL JSON (spec section 5) les remplacera en P3 ; les effets absents du registre
// passeront alors par le fallback manuel.

export function effectKey(templateId: string, stage: StageId, effectId: string): string {
  return `${templateId}/${stage}/${effectId}`;
}

export const NO_PARAMS: EffectParams = { targets: [], option: null };

/**
 * Les fonctions d'un effet (ou d'un déclencheur, d'un parchemin) s'exécutent dans l'extension de leur carte : les cartes
 * citées par numéro y sont cherchées (Merchants 19 n'est pas Feudal Kingdom 19). Chaque fonction reçoit le brouillon
 * en premier argument.
 */
export function withExpansion<T extends object>(impl: T, expansion: string): T {
  const out: Record<string, unknown> = { ...(impl as Record<string, unknown>) };
  for (const [key, value] of Object.entries(impl)) {
    if (typeof value !== "function") continue;
    const fn = value as (d: Draft, ...rest: unknown[]) => unknown;
    out[key] = (d: Draft, ...rest: unknown[]) => {
      const before = d.expansion;
      d.expansion = expansion;
      try {
        return fn(d, ...rest);
      } finally {
        d.expansion = before;
      }
    };
  }
  return out as T;
}

/** « Spend {coin} to gain {wood}/{stone} » : une option par ressource après le « / ». */
export function spendToGain(cost: readonly ResourceId[], gains: readonly (readonly ResourceId[])[]): EffectImpl {
  return {
    cost,
    // La carte s'engage comme une production qui coûte `cost` (Bazaar, Trader : demande du 2026-10-04).
    gains: () => gains.map((g) => [...g]),
    params: (d) => (canPay(d.s, cost) ? gains.map((_, i) => ({ targets: [], option: i })) : []),
    apply: (d, _card, p) => {
      pay(d.s, cost);
      gain(d.s, gains[p.option ?? 0] ?? []);
    },
  };
}
