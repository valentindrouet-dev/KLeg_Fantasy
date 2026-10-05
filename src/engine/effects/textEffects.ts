import type { CardTemplate, EffectType, ResourceId, StageId } from "../../data/schema";
import { boxCardsBySerial, offerDiscovery, playCard } from "../flow";
import {
  cardName,
  discard,
  gain,
  hasKeyword,
  instance,
  isFriendly,
  log,
  zoneOf,
} from "../state";
import type { EffectImpl } from "../types";
import { applyArrow } from "../upgrade";
import { NO_PARAMS, effectKey, spendToGain, withExpansion } from "./registry";

// Effets reconnus à leur texte imprimé exact. Couvre les cartes 1 à 10 (périmètre P1) et,
// mécaniquement, les autres cartes qui portent exactement le même texte.
// Seuls les types d'effet qui sont des actions du joueur sont concernés.

const ACTION_TYPES: readonly EffectType[] = ["activated", "destroy", "time"];

function icons(text: string, resources: readonly ResourceId[]): ResourceId[] | null {
  const tokens = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "");
  if (tokens.join("") !== text.replace(/[{}]/g, "")) return null; // autre chose que des icônes
  return tokens.every((t) => resources.includes(t)) ? tokens : null;
}

type Matcher = (text: string, t: CardTemplate, resources: readonly ResourceId[]) => EffectImpl | null;

const matchers: Matcher[] = [
  // « Spend {coin} to gain {wood}/{stone}. »
  (text, _t, resources) => {
    const m = /^Spend ((?:\{\w+\})+) to gain (.+)\.$/.exec(text);
    if (!m) return null;
    const cost = icons(m[1] ?? "", resources);
    const gains = (m[2] ?? "").split("/").map((g) => icons(g, resources));
    if (!cost || gains.some((g) => g === null)) return null;
    return spendToGain(cost, gains as ResourceId[][]);
  },

  // « Discard a friendly card to gain {coin}{coin}. » : une autre carte amie en jeu.
  (text, _t, resources) => {
    const m = /^Discard a friendly card to gain ((?:\{\w+\})+)\.$/.exec(text);
    const gains = m ? icons(m[1] ?? "", resources) : null;
    if (!gains) return null;
    return {
      params: (d, card) =>
        d.s.zones.play
          .filter((id) => id !== card && isFriendly(d.catalog, d.s, id))
          .map((id) => ({ targets: [id], option: null })),
      apply: (d, _card, p) => {
        for (const id of p.targets) {
          log(d.s, `${cardName(d.catalog, d.s, id)} est défaussée`);
          discard(d, id);
        }
        gain(d.s, gains);
      },
    };
  },

  // « Gain {wood}{wood}{wood}, then {rotate}. » : la rotation par effet n'est pas une amélioration.
  (text, _t, resources) => {
    const m = /^Gain ((?:\{\w+\})+), then \{rotate\}\.$/.exec(text);
    const gains = m ? icons(m[1] ?? "", resources) : null;
    if (!gains) return null;
    return {
      params: () => [NO_PARAMS],
      apply: (d, card) => {
        gain(d.s, gains);
        const c = instance(d.s, card);
        c.orientation = applyArrow(c.orientation, "rotate");
        if (zoneOf(d.s, card) !== "discard") discard(d, card); // règle d'or 3
        log(d.s, `${cardName(d.catalog, d.s, card)} : la carte est tournée`);
      },
    };
  },

  // « Discover Mine (84 / 85). » : voir les cartes, en choisir une, les autres restent dans la boîte.
  (text, t) => {
    const m = /^Discover [^(]+\(([\d\s/]+)\)\.$/.exec(text);
    if (!m) return null;
    const serials = (m[1] ?? "").split("/").map((n) => Number.parseInt(n.trim(), 10));
    const expansion = t.expansion;
    return {
      params: () => [NO_PARAMS],
      apply: (d, card) => {
        const options = boxCardsBySerial(d, serials).filter((id) => d.catalog.templates.get(instance(d.s, id).templateId)?.expansion === expansion);
        offerDiscovery(d, options, 1, "box", card);
      },
    };
  },

  // « Play 1 land or building from discard pile. » : la carte jouée entre en jeu.
  (text) => {
    const m = /^Play 1 (.+) from discard pile\.$/.exec(text);
    if (!m) return null;
    const kinds = (m[1] ?? "").split(" or ").map((k) => k.trim().toLowerCase());
    const any = kinds.length === 1 && kinds[0] === "card";
    if (!any && !kinds.every((k) => ["land", "building", "person"].includes(k))) return null;
    return {
      params: (d, card) =>
        d.s.zones.discard
          .filter((id) => id !== card) // docs/RULES_DECISIONS.md : la carte ne se rejoue pas elle-même
          .filter((id) => any || kinds.some((k) => hasKeyword(d.catalog, d.s, id, k)))
          .map((id) => ({ targets: [id], option: null })),
      apply: (d, _card, p) => {
        for (const id of p.targets) {
          playCard(d, id);
          log(d.s, `${cardName(d.catalog, d.s, id)} est jouée depuis la défausse`);
        }
      },
    };
  },
];

/** Construit le registre des effets reconnus pour un ensemble de cartes. */
export function textEffects(templates: Iterable<CardTemplate>, resources: readonly ResourceId[]): Map<string, EffectImpl> {
  const out = new Map<string, EffectImpl>();
  for (const t of templates) {
    for (const [key, stage] of Object.entries(t.stages)) {
      if (!stage) continue;
      for (const e of stage.effects) {
        if (!ACTION_TYPES.includes(e.type)) continue;
        for (const match of matchers) {
          const impl = match(e.text, t, resources);
          if (impl) {
            out.set(effectKey(t.id, Number(key) as StageId, e.id), withExpansion(impl, t.expansion));
            break;
          }
        }
      }
    }
  }
  return out;
}
