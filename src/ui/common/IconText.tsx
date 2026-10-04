import { Fragment, type ReactNode } from "react";
import styles from "./common.module.css";

// Icônes du jeu découpées dans les cartes (scripts/extract-icons.ts) ; les autres restent en caractères.
const IMAGES = import.meta.glob<string>("../icons/*.png", { eager: true, query: "?url", import: "default" });
export function iconImage(id: string): string | undefined {
  return IMAGES[`../icons/${id}.png`];
}

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
  const src = iconImage(id);
  if (src) return <img className={styles.iconImg} src={src} alt={icon?.label ?? id} title={icon?.label ?? id} draggable={false} />;
  return (
    <span className={styles.icon} title={icon?.label ?? id} aria-label={icon?.label ?? id} role="img">
      {icon?.glyph ?? `{${id}}`}
    </span>
  );
}

/** Image de chaque sticker de la planche Feudal Kingdom (data/stickers.json), découpée avec les autres icônes. */
const STICKER_ICONS: Record<string, string> = {
  "1": "coin",
  "2": "wood",
  "3": "stone",
  "4": "metal",
  "5": "sword",
  "6": "tradeGood",
  "7": "staysInPlay",
  "8": "fame2",
  "10": "fame5",
  "11": "knight",
  "13k": "scorePath",
  "16": "fame",
};

const STICKER_LABELS: Record<string, string> = { "7": "Stays in play", "8": "gloire 2", "10": "gloire 5", "11": "Knight", "13k": "chemin de score", "16": "gloire écrite" };

/** Symbole d'un sticker cité par son numéro (demande du 2026-10-05). */
export function StickerIcon({ id }: { id: string }) {
  const icon = STICKER_ICONS[id];
  const src = icon ? iconImage(icon) : undefined;
  if (!src) return null;
  const label = `Sticker ${id} : ${STICKER_LABELS[id] ?? ICONS[icon ?? ""]?.label ?? icon}`;
  return <img className={`${styles.iconImg} ${styles.stickerIcon}`} src={src} alt={label} title={label} draggable={false} />;
}

/** « sticker 1 / 2 », « sticker 1 & 5 & 11 », « sticker 13k » : le symbole suit chaque numéro. */
const STICKER_PHRASE = /(stickers? )(\d+k?(?:\s*(?:\/|&|and|or|,)\s*\d+k?)*)/gi;

function PlainText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(STICKER_PHRASE)) {
    const start = m.index ?? 0;
    out.push(text.slice(last, start), m[1]);
    const numbers = m[2] ?? "";
    numbers.split(/(\d+k?)/).forEach((piece, j) => {
      if (j % 2 === 0) out.push(piece);
      else
        out.push(
          <Fragment key={`${start}-${j}`}>
            {piece}
            <StickerIcon id={piece} />
          </Fragment>,
        );
    });
    last = start + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out.map((x, i) => (typeof x === "string" ? <Fragment key={i}>{x}</Fragment> : <Fragment key={i}>{x}</Fragment>))}</>;
}

export function IconText({ text }: { text: string }) {
  const parts = text.split(/\{(\w+)\}/g);
  return (
    <span>
      {parts.map((p, i) => (i % 2 === 1 ? <Icon key={i} id={p} /> : <PlainText key={i} text={p} />))}
    </span>
  );
}
