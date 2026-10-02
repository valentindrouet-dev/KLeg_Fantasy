import { usableEffects } from "./actions";
import { producedIcons, productionGroups } from "./production";
import { activeStage, cardName, formatIcons, instance, template } from "./state";
import type { Action, Catalog, GameState } from "./types";
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
  }
}
