import { Fragment } from "react";
import styles from "./common.module.css";

// Rendu des tokens d'icônes des textes de cartes ({coin}, {rotate}...).

export const ICONS: Record<string, { glyph: string; label: string }> = {
  coin: { glyph: "🪙", label: "Or" },
  wood: { glyph: "🪵", label: "Bois" },
  stone: { glyph: "🪨", label: "Pierre" },
  metal: { glyph: "🔩", label: "Métal" },
  sword: { glyph: "🗡️", label: "Épée" },
  tradeGood: { glyph: "📦", label: "Marchandise" },
  rotate: { glyph: "↓", label: "tourner" },
  flip: { glyph: "→", label: "retourner" },
  fame: { glyph: "🏅", label: "gloire" },
  mark: { glyph: "⊗", label: "case" },
  asterisk: { glyph: "✱", label: "astérisque" },
  negative: { glyph: "💀", label: "négative" },
  passive: { glyph: "∞", label: "passif" },
  activated: { glyph: "⚡", label: "activé" },
  time: { glyph: "⏳", label: "fin du tour" },
  destroy: { glyph: "🔥", label: "détruire" },
  triggeredOptional: { glyph: "◇", label: "déclenché, facultatif" },
  triggeredForced: { glyph: "◆", label: "déclenché, obligatoire" },
  oneTime: { glyph: "①", label: "une seule fois" },
};

export function Icon({ id }: { id: string }) {
  const icon = ICONS[id];
  return (
    <span className={styles.icon} title={icon?.label ?? id} aria-label={icon?.label ?? id} role="img">
      {icon?.glyph ?? `{${id}}`}
    </span>
  );
}

export function IconText({ text }: { text: string }) {
  const parts = text.split(/\{(\w+)\}/g);
  return (
    <span>
      {parts.map((p, i) => (i % 2 === 1 ? <Icon key={i} id={p} /> : <Fragment key={i}>{p}</Fragment>))}
    </span>
  );
}
