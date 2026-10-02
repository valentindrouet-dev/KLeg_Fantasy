import type { CardTemplate, ResourceId } from "../data/schema";
import { textEffects } from "./effects/textEffects";
import { runQueue } from "./flow";
import { feudalKingdomParchments } from "./scripts/parchments";
import { emptyResources, instance, log } from "./state";
import type { CardInstance, Catalog, Draft, GameConfig, GameState, InstanceId } from "./types";

// Catalogue des cartes et mise en place d'une partie (spec 4.3).

export const STARTING_KINGDOM: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const DEFAULT_EXPANSION = "FeudalKingdom";

export function createCatalog(templates: readonly CardTemplate[], resources: readonly ResourceId[]): Catalog {
  return {
    templates: new Map(templates.map((t) => [t.id, t])),
    resources,
    effects: textEffects(templates, resources),
    parchments: feudalKingdomParchments,
  };
}

/** Nouvelle partie : cartes 1 à 10 mélangées en deck face visible, le reste dans la boîte. */
export function createGame(catalog: Catalog, config: GameConfig): GameState {
  const templates = [...catalog.templates.values()]
    .filter((t) => t.expansion === config.expansion)
    .sort((a, b) => a.serial - b.serial);
  if (templates.length === 0) throw new Error(`Aucune carte pour l'extension ${config.expansion}`);

  const cards: Record<InstanceId, CardInstance> = {};
  for (const t of templates) {
    cards[t.id] = {
      instanceId: t.id,
      templateId: t.id,
      serial: t.serial,
      orientation: { side: "front", rotation: 0 },
      stickers: [],
      checkedBoxes: [],
      crossedOutEffects: [],
      crossedOutProduction: [],
    };
  }

  const s: GameState = {
    config,
    rng: config.seed | 0,
    round: 1,
    turn: 0,
    phase: "playing",
    finalRound: false,
    zones: { box: templates.map((t) => t.id), deck: [], play: [], discard: [], permanent: [], destroyed: [] },
    cards,
    resources: emptyResources(catalog),
    pending: null,
    queue: [{ kind: "shuffle" }, { kind: "startTurn" }],
    purgedFame: 0,
    revealCount: 0,
    lostResources: {},
    log: [],
  };

  for (const id of [...s.zones.box]) {
    if (STARTING_KINGDOM.includes(instance(s, id).serial)) {
      s.zones.box.splice(s.zones.box.indexOf(id), 1);
      s.zones.discard.push(id);
    }
  }
  log(s, "Manche 1");
  const d: Draft = { catalog, s };
  runQueue(d);
  return s;
}

/** Reset officiel (spec 4.6) : possible tant que la carte 23 n'est pas découverte. */
export function canRestartKingdom(s: GameState): boolean {
  return Object.values(s.cards).some((c) => c.serial === 23 && s.zones.box.includes(c.instanceId));
}
