import { usableEffects } from "./actions";
import { producedIcons, productionGroups } from "./production";
import { activeStage, cardName, formatIcons, instance, template } from "./state";
import type { Action, Answer, Catalog, GameState, ManualOp } from "./types";
import { applyArrow } from "./upgrade";

// Libellés français des actions (CLI, puis interface en P2).

export function describeAction(catalog: Catalog, s: GameState, a: Action): string {
  switch (a.type) {
    case "produce": {
      const icons = producedIcons(productionGroups(catalog, s, a.card), a.choices);
      return `Produire avec ${cardName(catalog, s, a.card)} : ${formatIcons(icons)}`;
    }
    case "upgrade": {
      const stage = activeStage(catalog, s, a.card);
      const u = stage?.upgrades.find((x) => x.id === a.upgrade);
      const c = instance(s, a.card);
      const t = template(catalog, c.templateId);
      const target = u ? t.stages[String(u.toStage) as "1" | "2" | "3" | "4"]?.name : undefined;
      const extra = a.discard.length ? `, en défaussant ${a.discard.map((id) => cardName(catalog, s, id)).join(", ")}` : "";
      const arrow = u ? (applyArrow(c.orientation, u.arrow).side === c.orientation.side ? "↓" : "→") : "";
      return `Améliorer ${cardName(catalog, s, a.card)} ${arrow} ${target ?? "?"} pour ${formatIcons(u?.cost ?? []) || "rien"}${extra} (fin du tour)`;
    }
    case "useEffect": {
      const e = usableEffects(catalog, s, a.card).find((x) => x.effect.id === a.effect)?.effect;
      // Option d'un « / » : on affiche l'alternative choisie (« {wood}/{stone} » → « {stone} »).
      const alternatives = /gain (.+)\.$/i.exec(e?.text ?? "")?.[1]?.split("/") ?? [];
      const chosen = a.option !== null && alternatives.length > 1 ? alternatives[a.option] : undefined;
      const details = [...a.targets.map((id) => cardName(catalog, s, id)), ...(chosen ? [`→ ${chosen}`] : [])];
      return `Effet de ${cardName(catalog, s, a.card)} : ${e?.text ?? a.effect}${details.length ? ` [${details.join(", ")}]` : ""}`;
    }
    case "advance":
      return `Avancer (jouer ${Math.min(2, s.zones.deck.length)} carte(s) de plus)`;
    case "pass":
      return "Passer (fin du tour)";
    case "chooseDiscovery":
      return `Découvrir #${instance(s, a.card).serial}`;
    case "chooseSide":
      return a.side === "front" ? "Garder le recto visible" : "Garder le verso visible";
    case "acknowledgeParchment":
      return "J'ai lu le parchemin";
    case "acknowledgeDiscoveries":
      return "J'ai vu les nouvelles cartes";
    case "manual":
      return describeManual(catalog, s, a.op);
    case "choose":
      return describeAnswer(catalog, s, a.answer);
    case "cancelChoice":
      return "Annuler l'effet";
    case "startExpansion":
      return `Jouer la mini-extension ${template(catalog, instance(s, a.card).templateId).stages["1"]?.name.replace(/ \(expansion\)$/, "") ?? ""}`;
  }
}

const ZONE_LABELS = {
  box: "Boîte",
  deck: "Pioche",
  play: "En jeu",
  discard: "Défausse",
  permanent: "Permanentes",
  destroyed: "Détruite",
  blocked: "Bloquée",
  purged: "Purgée",
} as const;

function describeAnswer(catalog: Catalog, s: GameState, a: Answer): string {
  if ("cards" in a) return a.cards.length ? a.cards.map((id) => cardName(catalog, s, id)).join(", ") : "Aucune carte";
  if ("resources" in a) return formatIcons(a.resources);
  if ("box" in a) return `Case ${a.box}`;
  const p = s.pending;
  return p?.kind === "choice" && p.request.type === "option" ? (p.request.labels[a.option] ?? String(a.option)) : String(a.option);
}

function describeManual(catalog: Catalog, s: GameState, op: ManualOp): string {
  switch (op.kind) {
    case "resource":
      return `${op.delta > 0 ? "+" : ""}${op.delta} {${op.resource}}`;
    case "move":
      return `${cardName(catalog, s, op.card)} → ${ZONE_LABELS[op.to]}${op.to === "deck" ? (op.position === "top" ? " (dessus)" : " (dessous)") : ""}`;
    case "orient":
      return `Réorienter ${cardName(catalog, s, op.card)}`;
    case "discover":
      return `Découvrir #${instance(s, op.card).serial}`;
    case "check":
      return `Cocher ${op.box} sur ${cardName(catalog, s, op.card)}`;
    case "sticker":
      return `Sticker ${op.resource !== null ? `{${op.resource}}` : `{fame} ${op.fame ?? 0}`} sur ${cardName(catalog, s, op.card)}`;
    case "effect": {
      const e = activeStage(catalog, s, op.card)?.effects.find((x) => x.id === op.effect);
      return `${e?.text ?? op.effect} (à la main)`;
    }
    case "skip":
      return "Passer la question";
    case "name":
      return `Nommer #${instance(s, op.card).serial} : ${op.name.trim()}`;
    case "refresh":
      return `Effets de ${cardName(catalog, s, op.card)} à nouveau utilisables`;
  }
}
