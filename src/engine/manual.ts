import { orientationKey, type Orientation, type StageId } from "../data/schema";
import { canAddResourceSticker } from "./production";
import { discover, endTurn } from "./flow";
import { activeStage, cardName, destroy, discard, instance, log, moveTo, stageIdAt, template, zoneOf } from "./state";
import { effectKey } from "./effects/registry";
import { ZONES, type Catalog, type Draft, type GameState, type InstanceId, type ManualOp, type StickerPlacement, type Zone } from "./types";

// Opérations « à la main » de la v0.17, retirées de l'interface en v0.18 (tous les effets sont automatisés), reprises
// par le mode développeur (demande du 2026-10-05) : hors règles, mais enregistrées comme les autres actions, donc
// annulables, sauvegardées et rejouées à l'import.

const ACTION_EFFECT_TYPES = ["activated", "destroy", "time"];

const ZONE_FR: Record<Zone, string> = {
  box: "la boîte",
  deck: "la pioche",
  play: "le jeu",
  discard: "la défausse",
  permanent: "les permanentes",
  destroyed: "les cartes détruites",
  blocked: "les cartes bloquées",
  purged: "les cartes purgées",
};

/** Clé d'une case cochée dans CardInstance.checkedBoxes. */
export function checkKey(stage: StageId, box: string): string {
  return `${stage}/${box}`;
}

/** Effets d'action du stage actif qui n'ont pas d'automatisation : on les utilise « à la main ». */
export function manualEffects(catalog: Catalog, s: GameState, id: InstanceId): string[] {
  if (!s.zones.play.includes(id)) return [];
  const stage = activeStage(catalog, s, id);
  if (!stage) return [];
  const c = instance(s, id);
  return stage.effects
    .filter((e) => ACTION_EFFECT_TYPES.includes(e.type))
    .filter((e) => !c.crossedOutEffects.includes(`${stage.id}/${e.id}`))
    .filter((e) => !catalog.effects.has(effectKey(c.templateId, stage.id, e.id)))
    .map((e) => e.id);
}

/** Orientations d'une carte qui montrent un stage (les autres n'existent pas sur la carte). */
export function validOrientations(catalog: Catalog, s: GameState, id: InstanceId): Orientation[] {
  const t = template(catalog, instance(s, id).templateId);
  const all: Orientation[] = [
    { side: "front", rotation: 0 },
    { side: "front", rotation: 180 },
    { side: "back", rotation: 0 },
    { side: "back", rotation: 180 },
  ];
  return all.filter((o) => stageIdAt(t, o) !== null);
}

/** Carte qu'on peut nommer : une de ses étapes dit « Give her/him a name! » (Stranger, #92). */
export function canBeNamed(catalog: Catalog, s: GameState, id: InstanceId): boolean {
  const t = template(catalog, instance(s, id).templateId);
  return Object.values(t.stages).some((st) => st?.effects.some((e) => /Give (her|him) a name!/.test(e.text)));
}

/** Les opérations libres (hors effets) : vérifiées ici plutôt qu'énumérées par getLegalActions. */
export function isManualOpValid(catalog: Catalog, s: GameState, op: ManualOp): boolean {
  if (s.phase !== "playing") return false;
  // Pendant une question : seulement les ressources, ou passer la question.
  if (op.kind === "resource")
    return catalog.resources.includes(op.resource) && Number.isInteger(op.delta) && op.delta !== 0 && (s.resources[op.resource] ?? 0) + op.delta >= 0;
  if (op.kind === "skip") return s.pending?.kind === "choice";
  if (op.kind === "name") {
    const name = op.name.trim();
    return Boolean(s.cards[op.card]) && canBeNamed(catalog, s, op.card) && name.length >= 1 && name.length <= 24 && name !== s.cards[op.card]?.customName;
  }
  if (s.pending) return false;
  switch (op.kind) {
    case "refresh": {
      const stage = s.cards[op.card] ? activeStage(catalog, s, op.card) : null;
      return Boolean(stage) && instance(s, op.card).crossedOutEffects.some((k) => k.startsWith(`${stage?.id}/`));
    }
    case "move": {
      // Les zones « bloquées » et « purgées » ne se remplissent que par leurs règles.
      if (!s.cards[op.card] || !ZONES.includes(op.to) || op.to === "blocked" || op.to === "purged") return false;
      return zoneOf(s, op.card) !== op.to || op.to === "deck";
    }
    case "orient": {
      const c = s.cards[op.card];
      if (!c) return false;
      const key = orientationKey(op.orientation);
      return key !== orientationKey(c.orientation) && validOrientations(catalog, s, op.card).some((o) => orientationKey(o) === key);
    }
    case "discover":
      return s.zones.box.includes(op.card) && instance(s, op.card).serial >= 1;
    case "check": {
      if (!s.cards[op.card]) return false;
      return activeStage(catalog, s, op.card)?.checkboxes.some((b) => b.id === op.box) ?? false;
    }
    case "sticker": {
      if (!s.cards[op.card] || op.sticker === "" || !activeStage(catalog, s, op.card)) return false;
      if ((op.resource === null) === (op.fame === null)) return false; // un sticker de ressource ou de gloire
      if (op.resource !== null) return catalog.resources.includes(op.resource) && canAddResourceSticker(catalog, s, op.card);
      return Number.isInteger(op.fame);
    }
    case "effect": {
      // Rejeu : tout effet d'action du stage actif, automatisé depuis ou non.
      const stage = s.zones.play.includes(op.card) ? activeStage(catalog, s, op.card) : null;
      return stage?.effects.some((e) => e.id === op.effect && ACTION_EFFECT_TYPES.includes(e.type)) ?? false;
    }
  }
}

export function executeManual(d: Draft, op: ManualOp): void {
  const { catalog, s } = d;
  switch (op.kind) {
    case "skip": {
      const p = s.pending;
      log(s, `Mode dev : question passée${p?.kind === "choice" ? ` (${cardName(catalog, s, p.source)})` : ""}`);
      s.pending = null;
      return;
    }
    case "name": {
      instance(s, op.card).customName = op.name.trim();
      log(s, `#${instance(s, op.card).serial} s'appelle désormais ${op.name.trim()}`);
      return;
    }
    case "refresh": {
      const stage = activeStage(catalog, s, op.card);
      const c = instance(s, op.card);
      c.crossedOutEffects = c.crossedOutEffects.filter((k) => !k.startsWith(`${stage?.id}/`));
      log(s, `Mode dev : effets de ${cardName(catalog, s, op.card)} à nouveau utilisables`);
      return;
    }
    case "resource": {
      s.resources[op.resource] = (s.resources[op.resource] ?? 0) + op.delta;
      log(s, `Mode dev : ${op.delta > 0 ? "+" : ""}${op.delta} {${op.resource}}`);
      return;
    }
    case "move": {
      const from = zoneOf(s, op.card);
      // Sortir une carte d'une zone cachée révèle une information (annulation stricte impossible ensuite).
      if ((from === "deck" || from === "box") && op.to !== from) s.revealCount += 1;
      moveTo(s, op.card, op.to, op.position);
      const where = op.to === "deck" ? `${op.position === "top" ? "le dessus" : "le dessous"} de la pioche` : ZONE_FR[op.to];
      log(s, `Mode dev : ${cardName(catalog, s, op.card)} va dans ${where}`);
      return;
    }
    case "orient": {
      instance(s, op.card).orientation = { ...op.orientation };
      log(s, `Mode dev : ${cardName(catalog, s, op.card)} est réorientée`);
      return;
    }
    case "discover": {
      log(s, `Mode dev : découverte de #${instance(s, op.card).serial}`);
      discover(d, op.card);
      return;
    }
    case "check": {
      const stage = activeStage(catalog, s, op.card);
      if (!stage) return;
      const c = instance(s, op.card);
      const key = checkKey(stage.id, op.box);
      const checked = c.checkedBoxes.includes(key);
      c.checkedBoxes = checked ? c.checkedBoxes.filter((k) => k !== key) : [...c.checkedBoxes, key];
      log(s, `Mode dev : ${cardName(catalog, s, op.card)}, case ${op.box} ${checked ? "décochée" : "cochée"}`);
      return;
    }
    case "sticker": {
      const stage = activeStage(catalog, s, op.card);
      if (!stage) return;
      const placement: StickerPlacement = { sticker: op.sticker, stage: stage.id };
      if (op.resource !== null) placement.resource = op.resource;
      if (op.fame !== null) placement.fame = op.fame;
      instance(s, op.card).stickers.push(placement);
      log(s, `Mode dev : sticker ${op.sticker} sur ${cardName(catalog, s, op.card)}`);
      return;
    }
    case "effect": {
      const stage = activeStage(catalog, s, op.card);
      const effect = stage?.effects.find((e) => e.id === op.effect);
      if (!stage || !effect) return;
      log(s, `${cardName(catalog, s, op.card)} : ${effect.text} (à la main)`);
      // Le coût lié au type est payé comme pour un effet automatisé ; le corps de l'effet reste au joueur.
      if (effect.type === "destroy") destroy(d, op.card);
      else discard(d, op.card);
      if (effect.oneTime) instance(s, op.card).crossedOutEffects.push(`${stage.id}/${effect.id}`);
      if (effect.type === "time") endTurn(d);
      return;
    }
  }
}
