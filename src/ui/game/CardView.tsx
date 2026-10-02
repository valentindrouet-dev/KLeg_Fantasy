import { useState, type ReactNode } from "react";
import { cardImageUrl } from "../../data/loadCards";
import type { CardTemplate, Orientation, StageId } from "../../data/schema";
import { stageFr } from "../../data/translations";
import { isFullImage, printedStage, stageIdAt, type StickerPlacement } from "../../engine";
import { IconText, iconImage } from "../common/IconText";
import { STICKER_SIZE, stickerSpots } from "./stickerLayout";
import { usePrefs } from "../common/prefs";
import { usePress, type TapPoint } from "../common/usePress";
import { FULL_IMAGE_EFFECT_RECT, ZONE_RECTS, zoneAtCard, type ZoneKind } from "./cardZones";
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
  /** Stickers posés sur la carte : dessinés sur la moitié de leur stage (si elle est visible). */
  stickers?: readonly StickerPlacement[];
  /** Seulement la moitié haute (carte au dernier stage ou qui reste en jeu : gain de place). */
  half?: boolean;
};

/** Image d'un sticker : ressource, gloire, Knight, « Stays in play ». */
function stickerIcon(st: StickerPlacement): { src: string | undefined; text: string } {
  if (st.resource) return { src: iconImage(st.resource), text: st.resource };
  if (st.fame !== undefined) return { src: iconImage(`fame${st.fame}`) ?? iconImage("fame"), text: String(st.fame) };
  if (st.keyword) return { src: iconImage(st.keyword.toLowerCase()), text: st.keyword };
  return { src: iconImage("staysInPlay"), text: "∞" };
}

/** Stickers d'une moitié : en haut à l'endroit, en bas à l'envers (même place, carte tournée de 180°). */
function Stickers({ template, stage, stickers, half }: { template: CardTemplate; stage: StageId | null; stickers: readonly StickerPlacement[]; half: "top" | "bottom" }) {
  if (stage === null) return null;
  const own = stickers.filter((st) => st.stage === stage);
  if (own.length === 0) return null;
  const spots = stickerSpots(template.stages[String(stage) as "1"], own.length);
  return (
    <>
      {own.map((st, i) => {
        const spot = spots[i];
        if (!spot) return null;
        const icon = stickerIcon(st);
        const size = STICKER_SIZE * 100;
        const left = half === "top" ? spot.left * 100 : 100 - spot.left * 100 - size;
        const top = half === "top" ? spot.top * 100 : 100 - spot.top * 100 - (size * 373) / 520;
        return (
          <span
            key={i}
            className={`${styles.sticker} ${half === "bottom" ? styles.rotated : ""}`}
            style={{ left: `${left}%`, top: `${top}%`, width: `${size}%` }}
            title={`Sticker ${st.sticker}`}
          >
            {icon.src ? <img src={icon.src} alt={icon.text} draggable={false} /> : <b>{icon.text}</b>}
            {st.fame !== undefined && !iconImage(`fame${st.fame}`) && <b className={styles.stickerFame}>{st.fame}</b>}
          </span>
        );
      })}
    </>
  );
}

export const ANIM_MS = 700;

type Hover = { zone: ZoneKind; half: "top" | "bottom"; x: number; y: number };

/** Stage visible dans la moitié haute ou basse de la carte (image pleine : la même étape partout). */
function stageInHalf(t: CardTemplate, o: Orientation, half: "top" | "bottom"): StageId | null {
  if (isFullImage(t)) return stageIdAt(t, o);
  return stageIdAt(t, half === "top" ? o : { side: o.side, rotation: o.rotation === 0 ? 180 : 0 });
}

/** Une face : image dans son orientation + numéros d'étape de chaque moitié. */
function Face({
  template,
  orientation,
  label,
  className,
  dimBottom,
  stickers,
}: {
  template: CardTemplate;
  orientation: Orientation;
  label: string;
  className?: string;
  dimBottom?: boolean;
  stickers?: readonly StickerPlacement[];
}) {
  const url = cardImageUrl(orientation.side === "front" ? template.images.front : template.images.back);
  // Moitiés réellement imprimées : une carte à image pleine n'a pas de moitié basse (pas de grisé, un seul numéro).
  const topId = stageIdAt(template, orientation);
  const bottomId = stageIdAt(template, { side: orientation.side, rotation: orientation.rotation === 0 ? 180 : 0 });
  const top = topId === null ? null : printedStage(template, topId);
  const bottom = bottomId === null ? null : printedStage(template, bottomId);
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
      {stickers && stickers.length > 0 && (
        <>
          <Stickers template={template} stage={topId} stickers={stickers} half="top" />
          <Stickers template={template} stage={bottomId} stickers={stickers} half="bottom" />
        </>
      )}
    </div>
  );
}

export function CardView(props: Props) {
  const { id, template, orientation, label, width, selected, engaged, targetable, dimBottom, flagged, onTwoFinger, dimmed, badge, onTap, onLongPress, zoneLabel, anim, stickers, half } =
    props;
  // Demi-carte : les positions touchées sont ramenées à la carte entière (zones cliquables inchangées).
  const yScale = half ? 0.5 : 1;
  const press = usePress(onTap ? (p) => onTap({ ...p, y: p.y * yScale }) : () => {}, onLongPress, onTwoFinger);
  const [hover, setHover] = useState<Hover | null>(null);
  const [clicked, setClicked] = useState(false); // pas de bulle après un clic, jusqu'à la sortie du pointeur
  const tooltipsFr = usePrefs((p) => p.tooltipsFr);
  const interactive = Boolean(onTap || onLongPress) && !anim;

  const stageId = hover ? stageInHalf(template, orientation, hover.half) : null;
  const stage = stageId ? template.stages[String(stageId) as "1" | "2" | "3" | "4"] : undefined;
  const fr = stageId && tooltipsFr ? stageFr(template.id, stageId) : undefined;
  const action = hover && zoneLabel ? zoneLabel(hover.zone) : null;
  const fullImage = isFullImage(template);
  const rect =
    hover && action && hover.zone !== "other" && hover.zone !== "bottom"
      ? fullImage && hover.zone === "effect"
        ? FULL_IMAGE_EFFECT_RECT
        : ZONE_RECTS[hover.zone]
      : null;

  const classes = [
    styles.card,
    selected && styles.selected,
    engaged && styles.engaged,
    targetable && styles.targetable,
    flagged && styles.marked,
    dimmed && styles.dimmed,
    interactive && styles.interactive,
    anim && (anim.kind === "rotate" ? styles.animRotate : styles.animFlip),
    half && !anim && styles.half,
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
        const y = ((e.clientY - r.top) / r.height) * yScale;
        setHover({ zone: zoneAtCard(x, y, fullImage), half: y < 0.5 ? "top" : "bottom", x: e.clientX, y: e.clientY });
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
          <Face template={template} orientation={orientation} label={label} stickers={stickers} />
          <Face template={template} orientation={anim.to} label={label} className={styles.backFace} stickers={stickers} />
        </div>
      ) : (
        // Pendant une rotation, la carte n'est plus grisée (sinon la moitié grisée passe en haut).
        <Face template={template} orientation={orientation} label={label} dimBottom={dimBottom && !anim && !half} stickers={stickers} />
      )}
      {rect && !anim && (
        <span
          className={styles.zoneHighlight}
          style={{
            left: `${rect.left * 100}%`,
            top: `${(rect.top / yScale) * 100}%`,
            width: `${rect.width * 100}%`,
            height: `${(rect.height / yScale) * 100}%`,
          }}
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
