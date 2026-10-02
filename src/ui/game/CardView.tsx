import { cardImageUrl } from "../../data/loadCards";
import type { CardTemplate, Orientation } from "../../data/schema";
import { usePress } from "../common/usePress";
import styles from "./Game.module.css";

// Une carte dans son orientation réelle (spec 7.4) : la face visible, tournée de 180° si besoin,
// pour que le stage actif soit lisible en haut.

type Props = {
  id?: string; // identifiant d'instance, repris en data-card pour ancrer la feuille d'actions
  template: CardTemplate;
  orientation: Orientation;
  label: string;
  width?: number;
  selected?: boolean;
  onTap?: () => void;
  onLongPress?: () => void;
};

export function CardView({ id, template, orientation, label, width, selected, onTap, onLongPress }: Props) {
  const press = usePress(onTap ?? (() => {}), onLongPress);
  const url = cardImageUrl(orientation.side === "front" ? template.images.front : template.images.back);
  const interactive = Boolean(onTap || onLongPress);
  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ""} ${interactive ? styles.interactive : ""}`}
      style={width ? { width } : undefined}
      data-card={id}
      role={interactive ? "button" : "img"}
      aria-label={label}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (onTap && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onTap();
        }
      }}
      {...(interactive ? press : {})}
    >
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          className={orientation.rotation === 180 ? styles.rotated : undefined}
        />
      ) : (
        <span className={styles.cardFallback}>{label}</span>
      )}
    </div>
  );
}
