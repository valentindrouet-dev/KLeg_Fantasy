import { useState, type ReactNode } from "react";
import { cardImageUrl } from "../../data/loadCards";
import type { CardTemplate, Orientation, StageId } from "../../data/schema";
import { stageFr } from "../../data/translations";
import { stageIdAt } from "../../engine";
import { IconText } from "../common/IconText";
import { usePress, type TapPoint } from "../common/usePress";
import { ZONE_RECTS, zoneAt, type ZoneKind } from "./cardZones";
import styles from "./Game.module.css";

// Une carte dans son orientation réelle (spec 7.4) : la face visible, tournée de 180° si besoin,
// pour que le stage actif soit lisible en haut. Au survol, traduction française du stage pointé ;
// pour une carte en jeu, zones cliquables (ressource, amélioration, effet).

type Props = {
  id?: string; // identifiant d'instance, repris en data-card pour ancrer la feuille d'actions
  template: CardTemplate;
  orientation: Orientation;
  label: string;
  width?: number;
  selected?: boolean;
  engaged?: boolean;
  badge?: ReactNode; // ex. « engagée »
  onTap?: (p: TapPoint) => void;
  onLongPress?: () => void;
  /** Libellé de l'action d'une zone (null : zone sans action). Active la surbrillance des zones. */
  zoneLabel?: (zone: ZoneKind) => string | null;
};

type Hover = { zone: ZoneKind; half: "top" | "bottom"; x: number; y: number };

/** Stage visible dans la moitié haute ou basse de la carte. */
function stageInHalf(t: CardTemplate, o: Orientation, half: "top" | "bottom"): StageId | null {
  return stageIdAt(t, half === "top" ? o : { side: o.side, rotation: o.rotation === 0 ? 180 : 0 });
}

export function CardView({ id, template, orientation, label, width, selected, engaged, badge, onTap, onLongPress, zoneLabel }: Props) {
  const press = usePress(onTap ?? (() => {}), onLongPress);
  const [hover, setHover] = useState<Hover | null>(null);
  const url = cardImageUrl(orientation.side === "front" ? template.images.front : template.images.back);
  const interactive = Boolean(onTap || onLongPress);

  const stageId = hover ? stageInHalf(template, orientation, hover.half) : null;
  const stage = stageId ? template.stages[String(stageId) as "1" | "2" | "3" | "4"] : undefined;
  const fr = stageId ? stageFr(template.id, stageId) : undefined;
  const action = hover && zoneLabel ? zoneLabel(hover.zone) : null;
  const rect = hover && action && hover.zone !== "other" && hover.zone !== "bottom" ? ZONE_RECTS[hover.zone] : null;

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ""} ${engaged ? styles.engaged : ""} ${interactive ? styles.interactive : ""}`}
      style={width ? { width } : undefined}
      data-card={id}
      role={interactive ? "button" : "img"}
      aria-label={label}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (onTap && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onTap({ x: 0.5, y: 0.75 });
        }
      }}
      {...(interactive ? press : {})}
      onPointerMove={(e) => {
        if (interactive) press.onPointerMove(e);
        if (e.pointerType === "touch") return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        setHover({ zone: zoneAt(x, y), half: y < 0.5 ? "top" : "bottom", x: e.clientX, y: e.clientY });
      }}
      onPointerLeave={(e) => {
        if (interactive) press.onPointerLeave();
        if (e.pointerType !== "touch") setHover(null);
      }}
    >
      {url ? (
        <img src={url} alt="" draggable={false} className={orientation.rotation === 180 ? styles.rotated : undefined} />
      ) : (
        <span className={styles.cardFallback}>{label}</span>
      )}
      {rect && (
        <span
          className={styles.zoneHighlight}
          style={{ left: `${rect.left * 100}%`, top: `${rect.top * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}
        />
      )}
      {badge && <span className={styles.badge}>{badge}</span>}
      {hover && (fr || action) && (
        <div className={styles.tooltip} style={{ left: Math.min(hover.x + 16, window.innerWidth - 336), top: Math.min(hover.y + 16, window.innerHeight - 160) }} role="tooltip">
          {action && (
            <p className={styles.tooltipAction}>
              <IconText text={action} />
            </p>
          )}
          {fr && (
            <>
              <strong>
                {fr.name || stage?.name}
                {stage?.name && fr.name !== stage.name ? <small> ({stage.name})</small> : null}
                {hover.half === "bottom" && <small> · stage suivant</small>}
              </strong>
              {fr.text && (
                <p>
                  <IconText text={fr.text} />
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
