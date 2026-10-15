import type { Orientation, ResourceId, StageId } from "../data/schema";
import { orientationKey } from "../data/schema";
import { pushFront } from "./flow";
import { coinMalus, gainWithRules, payPool } from "./passives";
import { canAddResourceSticker, productionCount } from "./production";
import { cardFame } from "./score";
import {
  activeStage,
  canPay,
  cardName,
  destroy,
  discard,
  hasKeyword,
  instance,
  isFriendly,
  log,
  moveTo,
  pay,
  stageIdAt,
  template,
  zoneOf,
} from "./state";
import type { Draft, GameState, InstanceId, StickerPlacement, Catalog } from "./types";
import { applyArrow } from "./upgrade";

// Opérations de jeu utilisées par les effets des cartes (effects/cards.ts).

// --- Ressources ---

/** Gain par un effet : un Pirate en jeu retire 1 {coin} à chaque gain (s'il y en a). */
export function effectGain(d: Draft, icons: readonly ResourceId[]): void {
  let out = [...icons];
  for (let i = coinMalus(d.catalog, d.s); i > 0; i--) {
    const j = out.indexOf("coin");
    if (j < 0) break;
    out = [...out.slice(0, j), ...out.slice(j + 1)];
  }
  gainWithRules(d.catalog, d.s, out);
}

export const canPayD = (d: Draft, cost: readonly ResourceId[]): boolean => canPay(d.s, cost, payPool(d.catalog, d.s));
export const payD = (d: Draft, cost: readonly ResourceId[]): void => pay(d.s, cost, payPool(d.catalog, d.s));

/** Ressources en main (pour « spend any 1 resource »). */
export const heldResources = (d: Draft): ResourceId[] => d.catalog.resources.filter((r) => (d.s.resources[r] ?? 0) > 0);

// --- Sélecteurs ---

/** Royaume (spec 4.6) : deck, jeu, défausse, permanentes ; jamais la boîte, les détruites ni les bloquées. */
export const kingdom = (s: GameState): InstanceId[] => [...s.zones.deck, ...s.zones.play, ...s.zones.discard, ...s.zones.permanent];

export const isKind = (d: Draft, id: InstanceId, keyword: string): boolean => hasKeyword(d.catalog, d.s, id, keyword);
export const isPerson = (d: Draft, id: InstanceId): boolean => isKind(d, id, "Person");
export const isEnemy = (d: Draft, id: InstanceId): boolean => isKind(d, id, "Enemy");
export const friendly = (d: Draft, id: InstanceId): boolean => isFriendly(d.catalog, d.s, id);
export const stageName = (d: Draft, id: InstanceId): string => activeStage(d.catalog, d.s, id)?.name ?? "";
/** Carte dont le nom imprimé contient « Wall » (Wall, Double Wall, Inner Wall, Sea Gate Wall). */
export const isWall = (d: Draft, id: InstanceId): boolean => /\bWall\b/.test(stageName(d, id));
export const hasProduction = (d: Draft, id: InstanceId): boolean => productionCount(d.catalog, d.s, id) > 0;
export const producesResource = (d: Draft, id: InstanceId, r: ResourceId): boolean =>
  activeStage(d.catalog, d.s, id)?.production.some((g) => g.options.some((o) => o.includes(r))) ?? false;
export const fameOf = (d: Draft, id: InstanceId): number => cardFame(d.catalog, d.s, id);

/** Peut-on détruire la carte ? (Ether Crystal, Handsome Rival tant que Lord Nimrod existe) */
export function canBeDestroyed(d: Draft, id: InstanceId): boolean {
  const stage = activeStage(d.catalog, d.s, id);
  if (!stage || stage.cannotBeDestroyed) return false;
  // Adventures : Young / Adept Apprentice, Morgan le Fey, tant que Merlin n'est pas détruit.
  if (stage.effects.some((e) => /^Cannot be destroyed (unless|until) Merlin (has already been|is) destroyed\.$/.test(e.text))) {
    const merlin = Object.values(d.s.cards).find((c) => template(d.catalog, c.templateId).stages["1"]?.name === "Merlin the Wise");
    return merlin !== undefined && zoneOf(d.s, merlin.instanceId) === "destroyed";
  }
  if (stage.effects.some((e) => e.text.startsWith("Cannot be destroyed unless Lord Nimrod has been destroyed"))) {
    const nimrod = Object.values(d.s.cards).find((c) => template(d.catalog, c.templateId).stages["4"]?.name === "Lord Nimrod");
    return nimrod !== undefined && zoneOf(d.s, nimrod.instanceId) === "destroyed";
  }
  return true;
}

/** Autres cartes en jeu que `self`, filtrées. */
export const otherInPlay = (d: Draft, self: InstanceId, keep: (id: InstanceId) => boolean = () => true): InstanceId[] =>
  d.s.zones.play.filter((id) => id !== self && keep(id));

// --- Orientation ---

const STAGE_ONE: Orientation = { side: "front", rotation: 0 };

/** Règle d'or 3 : une carte qui change d'orientation est défaussée (sauf dans la boîte, détruite ou déjà défaussée). */
function discardAfterTurn(d: Draft, id: InstanceId): void {
  const z = zoneOf(d.s, id);
  if (z === "play" || z === "deck" || z === "permanent" || z === "blocked") discard(d, id);
}

export function turnCard(d: Draft, id: InstanceId, arrow: "rotate" | "flip"): void {
  const c = instance(d.s, id);
  c.orientation = applyArrow(c.orientation, arrow);
  discardAfterTurn(d, id);
  log(d.s, `${cardName(d.catalog, d.s, id)} : la carte est ${arrow === "rotate" ? "tournée" : "retournée"}`);
}

export function setOrientation(d: Draft, id: InstanceId, o: Orientation): void {
  instance(d.s, id).orientation = { ...o };
  discardAfterTurn(d, id);
}

/** Reset : retour au stage de départ, sceau en haut (spec 4.6). */
export function resetCard(d: Draft, id: InstanceId): void {
  setOrientation(d, id, STAGE_ONE);
  log(d.s, `${cardName(d.catalog, d.s, id)} : reset`);
}

/** Dé-découvrir : reset puis retour dans la boîte. */
export function undiscover(d: Draft, id: InstanceId): void {
  instance(d.s, id).orientation = { ...STAGE_ONE };
  moveTo(d.s, id, "box");
  log(d.s, `#${instance(d.s, id).serial} retourne dans la boîte`);
}

/** Orientations qui montrent un stage, avec leur stage. */
export function orientations(d: Draft, id: InstanceId): { o: Orientation; stage: StageId }[] {
  const t = template(d.catalog, instance(d.s, id).templateId);
  const all: Orientation[] = [
    { side: "front", rotation: 0 },
    { side: "front", rotation: 180 },
    { side: "back", rotation: 0 },
    { side: "back", rotation: 180 },
  ];
  return all.flatMap((o) => {
    const stage = stageIdAt(t, o);
    return stage === null ? [] : [{ o, stage }];
  });
}

export const sameOrientation = (a: Orientation, b: Orientation): boolean => orientationKey(a) === orientationKey(b);

// --- Zones ---

export function discardCards(d: Draft, ids: readonly InstanceId[]): void {
  for (const id of ids) {
    // Healing Potion : « When discarding a person, you may reset this instead » (proposée parmi les personnes).
    if (!isPerson(d, id) && stageName(d, id) === "Healing Potion") {
      resetCard(d, id);
      continue;
    }
    log(d.s, `${cardName(d.catalog, d.s, id)} est défaussée`);
    discard(d, id);
  }
}

export function destroyCards(d: Draft, ids: readonly InstanceId[]): void {
  for (const id of ids) {
    if (protectedFromNegative(d, id)) continue;
    log(d.s, `${cardName(d.catalog, d.s, id)} est détruite`);
    destroy(d, id);
  }
}

/**
 * Adventures : une carte amie que l'effet d'une carte négative détruirait est sauvée par The Green Armor (personne en
 * armure, sticker 55) ou par Garrisoned Border, qui cochent une case à la place (décision du 2026-10-15 : d'office).
 */
function protectedFromNegative(d: Draft, id: InstanceId): boolean {
  const src = d.source;
  if (src === undefined || src === id || !d.s.cards[src] || isFriendly(d.catalog, d.s, src) || !isFriendly(d.catalog, d.s, id)) return false;
  const armored = instance(d.s, id).stickers.some((st) => st.keyword === "Armored");
  const saver =
    (armored ? d.s.zones.permanent.find((g) => stageName(d, g) === "The Green Armor" && unmarkedBoxes(d, g).length > 0) : undefined) ??
    d.s.zones.permanent.find((g) => stageName(d, g) === "Garrisoned Border" && unmarkedBoxes(d, g).length > 0);
  if (!saver) return false;
  log(d.s, `${cardName(d.catalog, d.s, id)} est sauvée par ${cardName(d.catalog, d.s, saver)}`);
  const next = unmarkedBoxes(d, saver)[0];
  if (next) {
    markBox(d, saver, next.stage, next.id);
    // Dernière case ({destroy}) : la carte qui protège est détruite à son tour.
    if (next.text?.includes("{destroy}")) {
      log(d.s, `${cardName(d.catalog, d.s, saver)} est détruite`);
      destroy(d, saver);
    }
  }
  return true;
}

/** Personnes qu'on peut défausser, Healing Potion comprise (elle se reset à la place). */
export function discardablePersons(d: Draft, self: InstanceId | null): InstanceId[] {
  return d.s.zones.play.filter((id) => id !== self && (isPerson(d, id) || stageName(d, id) === "Healing Potion"));
}

/** Bloque des cartes en jeu sous `blocker` (spec 4.6). */
export function blockCards(d: Draft, blocker: InstanceId, ids: readonly InstanceId[]): void {
  const blocks = (d.s.blocks ??= {});
  for (const id of ids) {
    if (!d.s.zones.play.includes(id)) continue;
    moveTo(d.s, id, "blocked");
    blocks[blocker] = [...(blocks[blocker] ?? []), id];
    log(d.s, `${cardName(d.catalog, d.s, blocker)} bloque ${cardName(d.catalog, d.s, id)}`);
  }
}

export const blockedBy = (s: GameState, blocker: InstanceId): InstanceId[] => s.blocks?.[blocker] ?? [];

export function putOnDeck(d: Draft, id: InstanceId, position: "top" | "bottom"): void {
  moveTo(d.s, id, "deck", position);
  log(d.s, `${cardName(d.catalog, d.s, id)} va ${position === "top" ? "sur" : "sous"} la pioche`);
}

export function keepInPlay(d: Draft, ids: readonly InstanceId[]): void {
  d.s.keepInPlay = [...new Set([...(d.s.keepInPlay ?? []), ...ids])];
  for (const id of ids) log(d.s, `${cardName(d.catalog, d.s, id)} reste en jeu`);
}

// --- Stickers ---

/** Pose un sticker sur le stage actif (sauf `stage` donné). Règle d'or 5 pour les stickers de ressource. */
export function addSticker(d: Draft, id: InstanceId, sticker: Omit<StickerPlacement, "stage">, stage?: StageId): boolean {
  const target = stage ?? activeStage(d.catalog, d.s, id)?.id;
  if (target === undefined) return false;
  if (sticker.resource !== undefined && stage === undefined && !canAddResourceSticker(d.catalog, d.s, id)) {
    log(d.s, `${cardName(d.catalog, d.s, id)} produit déjà 9 ou plus : pas de sticker de ressource (règle d'or 5)`);
    return false;
  }
  instance(d.s, id).stickers.push({ ...sticker, stage: target });
  log(d.s, `Sticker ${sticker.sticker} sur ${cardName(d.catalog, d.s, id)}`);
  return true;
}

/** Numéros des stickers de ressource de la planche Feudal Kingdom (data/stickers.json). */
export const RESOURCE_STICKER: Record<ResourceId, string> = { coin: "1", wood: "2", stone: "3", metal: "4", sword: "5", tradeGood: "6" };
export const STICKER_RESOURCE: Record<string, ResourceId> = Object.fromEntries(Object.entries(RESOURCE_STICKER).map(([r, n]) => [n, r]));

export function addResourceStickerOf(d: Draft, id: InstanceId, r: ResourceId, stage?: StageId): boolean {
  return addSticker(d, id, { sticker: RESOURCE_STICKER[r] ?? "?", resource: r }, stage);
}

/** Booster : +1 d'une ressource que la carte produit déjà. */
export const boostOptions = (d: Draft, id: InstanceId): ResourceId[] => d.catalog.resources.filter((r) => producesResource(d, id, r));

// --- Cases à cocher (pistes) ---

export const checkKey = (stage: StageId, box: string): string => `${stage}/${box}`;

export function isMarked(s: GameState, id: InstanceId, stage: StageId, box: string): boolean {
  return instance(s, id).checkedBoxes.includes(checkKey(stage, box));
}

/** Cases du stage actif (ou du stage donné), dans l'ordre imprimé. */
export function boxesOf(catalog: Catalog, s: GameState, id: InstanceId, stage?: StageId) {
  const t = template(catalog, instance(s, id).templateId);
  const sid = stage ?? activeStage(catalog, s, id)?.id;
  return sid === undefined ? [] : (t.stages[String(sid) as "1"]?.checkboxes ?? []).map((b) => ({ ...b, stage: sid }));
}

export const unmarkedBoxes = (d: Draft, id: InstanceId, stage?: StageId) =>
  boxesOf(d.catalog, d.s, id, stage).filter((b) => !isMarked(d.s, id, b.stage, b.id));

export const markedCount = (s: GameState, catalog: Catalog, id: InstanceId, stage?: StageId): number =>
  boxesOf(catalog, s, id, stage).filter((b) => isMarked(s, id, b.stage, b.id)).length;

/** Coche une case et applique ce qu'elle contient (ressources gagnées). Le coût éventuel est payé par l'appelant. */
export function markBox(d: Draft, id: InstanceId, stage: StageId, box: string): void {
  const c = instance(d.s, id);
  if (c.checkedBoxes.includes(checkKey(stage, box))) return;
  c.checkedBoxes.push(checkKey(stage, box));
  // Trading With Pixies : « If you haven't marked any {mark} this turn ».
  c.turnMarks = { ...(c.turnMarks ?? {}), mark: `${d.s.round}/${d.s.turn}` };
  const b = boxesOf(d.catalog, d.s, id, stage).find((x) => x.id === box);
  log(d.s, `${cardName(d.catalog, d.s, id)} : case ${box} cochée`);
  if (b?.gain?.length) effectGain(d, b.gain);
}

/** Toutes les cases du stage sont cochées ? */
export const trackComplete = (d: Draft, id: InstanceId, stage: StageId): boolean =>
  boxesOf(d.catalog, d.s, id, stage).every((b) => isMarked(d.s, id, b.stage, b.id));

// --- Effets en file ---

/** Lance plus tard (après l'effet en cours) un déclencheur par sa clé de script. */
export function queueScript(d: Draft, card: InstanceId, script: string): void {
  pushFront(d, { kind: "trigger", card, script, ctx: {} });
}

export const fameAtLeast = (d: Draft, id: InstanceId, n: number): boolean => fameOf(d, id) >= n;
export const friendlyOrSelf = (d: Draft, id: InstanceId): boolean => friendly(d, id);

// --- Moments du tour ---

/** Ce moment (« mark », « firstPerson »…) a-t-il déjà eu lieu ce tour pour cette carte ? */
export const doneThisTurn = (d: Draft, id: InstanceId, key: string): boolean => instance(d.s, id).turnMarks?.[key] === `${d.s.round}/${d.s.turn}`;

export function setDoneThisTurn(d: Draft, id: InstanceId, key: string): void {
  const c = instance(d.s, id);
  c.turnMarks = { ...(c.turnMarks ?? {}), [key]: `${d.s.round}/${d.s.turn}` };
}
