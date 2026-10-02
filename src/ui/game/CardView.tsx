import { useState, type ReactNode } from "react";
import { cardImageUrl } from "../../data/loadCards";
import type { CardTemplate, Orientation, StageId } from "../../data/schema";
import { stageFr } from "../../data/translations";
import { stageIdAt } from "../../engine";
import { IconText } from "../common/IconText";
import { usePrefs } from "../common/prefs";
import { usePress, type TapPoint } from "../common/usePress";
import { ZONE_RECTS, zoneAt, type ZoneKind } from "./cardZones";
import styles from "./Game.module.css";

// Une carte dans son orientation réelle (spec 7.4) : la face visible, tournée de 180° si besoin,
// pour que le stage actif soit lisible en haut. Au survol, traduction française du stage pointé ;
// pour une carte en jeu, zones cliquables (ressource, amélioration, effet).

type Props = {
  id?: string; // identifiant d'instance, repris en data-card (ancrage, animations)
  template: CardTemplate;
  orientation: Orientation;
  label: string;
  width?: number;
  selected?: boolean;
  engaged?: boolean;
  targetable?: boolean; // cible possible de l'effet en cours
  dimBottom?: boolean; // griser la moitié basse (stage suivant)
  flagged?: boolean; // contour bleu posé par un toucher à deux doigts
  onTwoFinger?: () => void;
  dimmed?: boolean;
  badge?: ReactNode;
  onTap?: (p: TapPoint) => void;
  onLongPress?: () => void;
  /** Libellé de l'action d'une zone (null : zone sans action). Active la surbrillance des zones. */
  zoneLabel?: (zone: ZoneKind) => string | null;
  /** Animation de changement d'orientation : rotation 180° ou retournement, vers `to`. */
  anim?: { kind: "rotate" | "flip"; to: Orientation };
};

export const ANIM_MS = 700;

type Hover = { zone: ZoneKind; half: "top" | "bottom"; x: number; y: number };

/** Stage visible dans la moitié haute ou basse de la carte. */
function stageInHalf(t: CardTemplate, o: Orientation, half: "top" | "bottom"): StageId | null {
  return stageIdAt(t, half === "top" ? o : { side: o.side, rotation: o.rotation === 0 ? 180 : 0 });
}

/** Une face : image dans son orientation + numéros d'étape de chaque moitié. */
function Face({
  template,
  orientation,
  label,
  className,
  dimBottom,
}: {
  template: CardTemplate;
  orientation: Orientation;
  label: string;
  className?: string;
  dimBottom?: boolean;
}) {
  const url = cardImageUrl(orientation.side === "front" ? template.images.front : template.images.back);
  const top = stageInHalf(template, orientation, "top");
  const bottom = stageInHalf(template, orientation, "bottom");
  return (
    <div className={`${styles.face} ${className ?? ""}`}>
      {url ? (
        <img src={url} alt="" draggable={false} className={orientation.rotation === 180 ? styles.rotated : undefined} />
      ) : (
        <span className={styles.cardFallback}>{label}</span>
      )}
      {dimBottom && top !== null && bottom !== null && <span className={styles.bottomShade} />}
      {top !== null && <span className={`${styles.stageNumber} ${styles.stageTop} ${styles[`stage${top}`]}`}>{top}</span>}
      {bottom !== null && <span className={`${styles.stageNumber} ${styles.stageBottom} ${styles[`stage${bottom}`]}`}>{bottom}</span>}
    </div>
  );
}

export function CardView(props: Props) {
  const { id, template, orientation, label, width, selected, engaged, targetable, dimBottom, flagged, onTwoFinger, dimmed, badge, onTap, onLongPress, zoneLabel, anim } =
    props;
  const press = usePress(onTap ?? (() => {}), onLongPress, onTwoFinger);
  const [hover, setHover] = useState<Hover | null>(null);
  const [clicked, setClicked] = useState(false); // pas de bulle après un clic, jusqu'à la sortie du pointeur
  const tooltipsFr = usePrefs((p) => p.tooltipsFr);
  const interactive = Boolean(onTap || onLongPress) && !anim;

  const stageId = hover ? stageInHalf(template, orientation, hover.half) : null;
  const stage = stageId ? template.stages[String(stageId) as "1" | "2" | "3" | "4"] : undefined;
  const fr = stageId && tooltipsFr ? stageFr(template.id, stageId) : undefined;
  const action = hover && zoneLabel ? zoneLabel(hover.zone) : null;
  const rect = hover && action && hover.zone !== "other" && hover.zone !== "bottom" ? ZONE_RECTS[hover.zone] : null;

  const classes = [
    styles.card,
    selected && styles.selected,
    engaged && styles.engaged,
    targetable && styles.targetable,
    flagged && styles.marked,
    dimmed && styles.dimmed,
    interactive && styles.interactive,
    anim && (anim.kind === "rotate" ? styles.animRotate : styles.animFlip),
  ].filter(Boolean);

  return (
    <div
      className={classes.join(" ")}
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
      onPointerDown={(e) => {
        if (interactive) press.onPointerDown(e);
        setClicked(true);
        setHover(null);
      }}
      onPointerMove={(e) => {
        if (interactive) press.onPointerMove(e);
        if (e.pointerType === "touch" || anim || clicked) return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        setHover({ zone: zoneAt(x, y), half: y < 0.5 ? "top" : "bottom", x: e.clientX, y: e.clientY });
      }}
      onPointerLeave={(e) => {
        if (interactive) press.onPointerLeave(e);
        setClicked(false);
        if (e.pointerType !== "touch") setHover(null);
      }}
    >
      {anim?.kind === "flip" ? (
        // Retournement : deux faces dos à dos, la carte pivote d'un seul mouvement.
        <div className={styles.flipInner}>
          <Face template={template} orientation={orientation} label={label} />
          <Face template={template} orientation={anim.to} label={label} className={styles.backFace} />
        </div>
      ) : (
        // Pendant une rotation, la carte n'est plus grisée (sinon la moitié grisée passe en haut).
        <Face template={template} orientation={orientation} label={label} dimBottom={dimBottom && !anim} />
      )}
      {rect && !anim && (
        <span
          className={styles.zoneHighlight}
          style={{ left: `${rect.left * 100}%`, top: `${rect.top * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}
        />
      )}
      {badge && <span className={styles.badge}>{badge}</span>}
      {hover && !anim && (fr || (action && tooltipsFr)) && (
        <div
          className={styles.tooltip}
          style={{ left: Math.min(hover.x + 16, window.innerWidth - 336), top: Math.min(hover.y + 16, window.innerHeight - 160) }}
          role="tooltip"
        >
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
