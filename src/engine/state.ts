import {
  orientationKey,
  type CardTemplate,
  type Orientation,
  type ResourceId,
  type Stage,
  type StageId,
} from "../data/schema";
import {
  ZONES,
  type CardInstance,
  type Catalog,
  type Draft,
  type GameState,
  type InstanceId,
  type ResourceCounts,
  type Zone,
} from "./types";

// Accès et mutations élémentaires de l'état. Les mutations ne s'appliquent qu'à un brouillon
// (copie faite par applyAction), jamais à un état reçu de l'extérieur.

export function template(catalog: Catalog, templateId: string): CardTemplate {
  const t = catalog.templates.get(templateId);
  if (!t) throw new Error(`Carte inconnue : ${templateId}`);
  return t;
}

export function instance(s: GameState, id: InstanceId): CardInstance {
  const c = s.cards[id];
  if (!c) throw new Error(`Instance inconnue : ${id}`);
  return c;
}

export function stageIdAt(t: CardTemplate, o: Orientation): StageId | null {
  return t.orientationToStage[orientationKey(o)];
}

/**
 * Numéro d'étape à afficher. Les cartes à une seule étape par face (image pleine : flèches rouges, objectifs,
 * parchemins…) ont les étapes 1 et 2 ; le site les numérote 1 et 4, numéro gardé dans les fiches.
 */
export function printedStage(t: CardTemplate, id: StageId): StageId {
  const used = Object.values(t.orientationToStage);
  const onePerFace = !used.includes(2) && !used.includes(3);
  return onePerFace && id === 4 ? 2 : id;
}

/** Stage actif d'une carte (celui qui est lisible en haut). */
export function activeStage(catalog: Catalog, s: GameState, id: InstanceId): Stage | null {
  const c = instance(s, id);
  const t = template(catalog, c.templateId);
  const sid = stageIdAt(t, c.orientation);
  return sid === null ? null : (t.stages[String(sid) as "1" | "2" | "3" | "4"] ?? null);
}

export function activeStageOrThrow(catalog: Catalog, s: GameState, id: InstanceId): Stage {
  const st = activeStage(catalog, s, id);
  if (!st) throw new Error(`Pas de stage actif pour ${id}`);
  return st;
}

export function cardName(catalog: Catalog, s: GameState, id: InstanceId): string {
  const st = activeStage(catalog, s, id);
  const serial = instance(s, id).serial;
  return st?.name ? `${st.name} (#${serial})` : `#${serial}`;
}

/** Mots-clés du stage actif, y compris ceux des stickers (sticker 11 : Knight). */
export function keywordsOf(catalog: Catalog, s: GameState, id: InstanceId): string[] {
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  const stickers = instance(s, id).stickers.flatMap((st) => (st.stage === stage.id && st.keyword ? [st.keyword] : []));
  return [...stage.keywords, ...stickers];
}

export function hasKeyword(catalog: Catalog, s: GameState, id: InstanceId, keyword: string): boolean {
  const k = keyword.toLowerCase();
  return keywordsOf(catalog, s, id).some((w) => w.toLowerCase() === k);
}

/** Amie = non négative (spec 4.6 : purge, cibles « friendly »). */
export function isFriendly(catalog: Catalog, s: GameState, id: InstanceId): boolean {
  return !(activeStage(catalog, s, id)?.negative ?? false);
}

export function zoneOf(s: GameState, id: InstanceId): Zone {
  for (const z of ZONES) if ((s.zones[z] ?? []).includes(id)) return z;
  throw new Error(`Carte hors de toute zone : ${id}`);
}

export function removeFromZones(s: GameState, id: InstanceId): void {
  for (const z of ZONES) {
    const list = s.zones[z] ?? [];
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
  }
}

/**
 * Déplace une carte. Deck : `top` place la carte dessus. Défausse : toujours dessus.
 * Une bloquante qui quitte le jeu pendant le tour libère ses cartes bloquées en zone de jeu (spec 4.6),
 * sans qu'elles soient « jouées ». Une carte bloquée qui sort de sous sa bloquante n'est plus bloquée.
 */
export function moveTo(s: GameState, id: InstanceId, zone: Zone, position: "top" | "bottom" = "bottom"): void {
  const blocks = s.blocks ?? {};
  for (const [blocker, list] of Object.entries(blocks)) {
    if (list.includes(id)) blocks[blocker] = list.filter((x) => x !== id);
  }
  const held = blocks[id];
  if (held?.length && zone !== "play") {
    delete blocks[id];
    for (const b of held) {
      removeFromZones(s, b);
      s.zones.play.push(b);
    }
  }
  removeFromZones(s, id);
  if (zone === "deck" && position === "top") s.zones.deck.unshift(id);
  else (s.zones[zone] ??= []).push(id);
}

/** Défausse une carte ; une carte dont le stage actif est permanent rejoint les permanentes (spec 4.6). */
export function discard(d: Draft, id: InstanceId): void {
  const permanent = activeStage(d.catalog, d.s, id)?.permanent ?? false;
  moveTo(d.s, id, permanent ? "permanent" : "discard");
}

export function destroy(d: Draft, id: InstanceId): void {
  moveTo(d.s, id, "destroyed");
}

export function log(s: GameState, text: string): void {
  s.log.push({ round: s.round, turn: s.turn, text });
}

// --- Ressources (spec 4.5) ---

export function emptyResources(catalog: Catalog): ResourceCounts {
  return Object.fromEntries(catalog.resources.map((r) => [r, 0]));
}

export function countIcons(icons: readonly ResourceId[]): ResourceCounts {
  const out: ResourceCounts = {};
  for (const r of icons) out[r] = (out[r] ?? 0) + 1;
  return out;
}

/**
 * Ressources interchangeables pour payer (Wood Shipment : {tradeGood} et {wood}), ou null.
 * Calculé par passives.ts (interchangeable) et passé aux fonctions de paiement.
 */
export type Pool = readonly ResourceId[] | null;

export function canPay(s: GameState, cost: readonly ResourceId[], pool: Pool = null): boolean {
  return missingFor(s, cost, pool).length === 0;
}

/** Ressources qui manquent pour payer `cost` (une entrée par icône manquante). */
export function missingFor(s: GameState, cost: readonly ResourceId[], pool: Pool = null): ResourceId[] {
  const missing: ResourceId[] = [];
  let spare = 0; // surplus des ressources interchangeables, utilisable pour les autres du groupe
  const counts = countIcons(cost);
  if (pool) for (const r of pool) spare += Math.max(0, (s.resources[r] ?? 0) - (counts[r] ?? 0));
  for (const [r, n] of Object.entries(counts)) {
    const have = s.resources[r] ?? 0;
    for (let i = have; i < n; i++) {
      if (pool?.includes(r) && spare > 0) spare -= 1;
      else missing.push(r);
    }
  }
  return missing;
}

export function pay(s: GameState, cost: readonly ResourceId[], pool: Pool = null): void {
  if (!canPay(s, cost, pool)) throw new Error(`Ressources insuffisantes pour ${cost.join(", ")}`);
  for (const r of cost) {
    if ((s.resources[r] ?? 0) > 0) s.resources[r] = (s.resources[r] ?? 0) - 1;
    else {
      const other = pool?.find((x) => x !== r && (s.resources[x] ?? 0) > 0);
      if (other === undefined) throw new Error(`Ressources insuffisantes pour ${cost.join(", ")}`);
      s.resources[other] = (s.resources[other] ?? 0) - 1;
    }
  }
}

export function gain(s: GameState, icons: readonly ResourceId[]): void {
  for (const r of icons) s.resources[r] = (s.resources[r] ?? 0) + 1;
}

export function totalResources(r: ResourceCounts): number {
  return Object.values(r).reduce((a, b) => a + b, 0);
}

/** Toutes les ressources sont perdues (nouvelle carte en jeu, fin de tour). */
export function clearResources(s: GameState): void {
  for (const [r, n] of Object.entries(s.resources)) {
    if (n > 0) s.lostResources[r] = (s.lostResources[r] ?? 0) + n;
    s.resources[r] = 0;
  }
}

export function formatIcons(icons: readonly ResourceId[]): string {
  return icons.map((r) => `{${r}}`).join("");
}

export function formatCounts(r: ResourceCounts): string {
  const icons = Object.entries(r).flatMap(([k, n]) => Array.from({ length: n }, () => k));
  return icons.length ? formatIcons(icons) : "rien";
}
