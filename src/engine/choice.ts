import { weightedPicks } from "./upgrade";
import type { ResourceId } from "../data/schema";
import type { Answer, ChoiceRequest, InstanceId } from "./types";
import { combinations } from "./upgrade";

// Choix du joueur au cours d'un effet (spec 4.1, décisions en attente) : questions et réponses sérialisables.

/** Réponse valable pour la question ? */
export function isValidAnswer(req: ChoiceRequest, a: Answer): boolean {
  switch (req.type) {
    case "cards": {
      if (!("cards" in a)) return false;
      const unique = new Set(a.cards);
      if (a.cards.length === 0 && req.none !== undefined) return true;
      if (req.need !== undefined) {
        const w = (id: InstanceId) => req.weights?.[id] ?? 1;
        const total = a.cards.reduce((n, id) => n + w(id), 0);
        if (total < req.need || a.cards.some((id) => total - w(id) >= req.need!)) return false;
        return unique.size === a.cards.length && a.cards.length >= 1 && a.cards.every((c) => req.options.includes(c));
      }
      return unique.size === a.cards.length && a.cards.length >= req.min && a.cards.length <= req.max && a.cards.every((c) => req.options.includes(c));
    }
    case "resources":
      return "resources" in a && a.resources.length === req.count && a.resources.every((r) => req.options.includes(r));
    case "option":
      if ("box" in a) return (req.boxes ?? []).includes(a.box);
      return "option" in a && Number.isInteger(a.option) && a.option >= 0 && a.option < req.labels.length;
  }
}

/** Multi-ensembles de `k` éléments pris dans `items` (répétitions permises), dans l'ordre des items. */
function multisets<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((first, i) => multisets(items.slice(i), k - 1).map((rest) => [first, ...rest]));
}

const MAX_ENUMERATED = 400;

/** Réponses possibles (énumérées jusqu'à une limite ; les autres restent valables via isValidAnswer). */
export function enumerateAnswers(req: ChoiceRequest): Answer[] {
  switch (req.type) {
    case "cards": {
      const out: Answer[] = req.none !== undefined && req.min > 0 ? [{ cards: [] }] : [];
      if (req.need !== undefined) {
        const need = req.need;
        return [...out, ...weightedPicks(req.options, need, (id) => req.weights?.[id] ?? 1).slice(0, MAX_ENUMERATED).map((cards) => ({ cards }))];
      }
      for (let k = req.min; k <= Math.min(req.max, req.options.length); k++) {
        for (const pick of combinations(req.options, k)) {
          out.push({ cards: pick });
          if (out.length >= MAX_ENUMERATED) return out;
        }
      }
      return out;
    }
    case "resources":
      return multisets(req.options, req.count).slice(0, MAX_ENUMERATED).map((resources) => ({ resources }));
    case "option":
      return req.labels.map((_, option) => ({ option }));
  }
}

/** Réponse imposée quand il n'y a pas de vrai choix (une seule possibilité), sinon null. */
export function forcedAnswer(req: ChoiceRequest): Answer | null {
  switch (req.type) {
    case "cards":
      if (req.need !== undefined) {
        const picks = weightedPicks(req.options, req.need, (id) => req.weights?.[id] ?? 1);
        return req.none === undefined && picks.length === 1 && picks[0] ? { cards: picks[0] } : null;
      }
      return req.none === undefined && req.min === req.max && req.options.length === req.min ? { cards: [...req.options] } : null;
    case "resources":
      return req.options.length === 1 ? { resources: Array.from({ length: req.count }, () => req.options[0] ?? "") } : null;
    case "option":
      // Plusieurs cases à toucher (Astronomer : cases identiques) : c'est le joueur qui choisit la case.
      return req.labels.length === 1 && (req.boxes?.length ?? 0) <= 1 ? { option: 0 } : null;
  }
}

/** Pose les questions d'un effet en répondant d'office à celles qui n'ont qu'une réponse ; renvoie la première vraie question. */
export function nextQuestion(ask: (answers: Answer[]) => ChoiceRequest | null, answers: Answer[]): ChoiceRequest | null {
  for (let guard = 0; guard < 50; guard++) {
    const req = ask(answers);
    if (!req) return null;
    const forced = forcedAnswer(req);
    if (!forced) return req;
    answers.push(forced);
  }
  return null;
}

// --- Questions toutes faites ---

/** Choix de personnes qui comptent pour `need` (Miners compte pour 2). */
export const askPersons = (prompt: string, options: InstanceId[], need: number, weight: (id: InstanceId) => number): ChoiceRequest => ({
  type: "cards",
  prompt,
  options,
  min: 1,
  max: Math.min(need, options.length),
  weights: Object.fromEntries(options.map((id) => [id, weight(id)])),
  need,
});

export const askCards = (prompt: string, options: InstanceId[], min: number, max = min): ChoiceRequest => ({
  type: "cards",
  prompt,
  options,
  min: Math.min(min, options.length),
  max: Math.min(max, options.length),
});

/** Choix de cartes qu'on peut aussi refuser (réponse vide, bouton `none`). */
export const askCardsOrNone = (prompt: string, options: InstanceId[], min: number, max: number, none: string): ChoiceRequest => ({
  type: "cards",
  prompt,
  options,
  min: Math.min(min, options.length),
  max: Math.min(max, options.length),
  none,
});

export const askResources = (prompt: string, options: readonly ResourceId[], count: number): ChoiceRequest => ({
  type: "resources",
  prompt,
  options: [...options],
  count,
});

export const askOption = (prompt: string, labels: string[]): ChoiceRequest => ({ type: "option", prompt, labels });

// --- Lecture des réponses ---

export const cardsOf = (a: Answer | undefined): InstanceId[] => (a && "cards" in a ? a.cards : []);
export const resourcesOf = (a: Answer | undefined): ResourceId[] => (a && "resources" in a ? a.resources : []);
export const optionOf = (a: Answer | undefined): number => (a && "option" in a ? a.option : -1);
export const boxOf = (a: Answer | undefined): string | null => (a && "box" in a ? a.box : null);

/** Question « quelle case ? » : options (libellés) et cases à toucher sur la carte. */
export const askBox = (prompt: string, labels: string[], boxes: string[]): ChoiceRequest => ({ type: "option", prompt, labels, boxes });
