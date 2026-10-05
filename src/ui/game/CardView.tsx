import { useState, type ReactNode } from "react";
import { cardImageUrl } from "../../data/loadCards";
import type { CardTemplate, Orientation, StageId } from "../../data/schema";
import { activeStage, cardFame, isFullImageFace, kingdomCards, printedStage, stageIdAt, type BoxView, type ExhaustedEffect, type StickerPlacement } from "../../engine";
import type { GoalView } from "./goals";
import { useGame } from "./store";
import { boxRects } from "../../data/checkboxes";
import { fameSpot } from "../../data/fameIcons";
import { costIconRects } from "../../data/upgradeIcons";
import { effectLines, type TextLine } from "../../data/textLines";
import { IconText, iconImage } from "../common/IconText";
import { fameStickerSpots, STICKER_SIZE, stickerSpots } from "./stickerLayout";
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
  onLongPress?: (p: TapPoint) => void;
  /** Objectifs du joueur sur cette carte : moitiés visées et boîte d'amélioration qui y mène, en doré. */
  goal?: GoalView;
  /** Carte de la partie à laquelle s'applique la marque « rayée » (glissé horizontal, halo rouge). Par défaut `id`. */
  markId?: string;
  /** Libellé de l'action d'une zone (null : zone sans action). Active la surbrillance des zones. */
  zoneLabel?: (zone: ZoneKind) => string | null;
  /** Animation de changement d'orientation : rotation 180° ou retournement, vers `to`. */
  anim?: { kind: "rotate" | "flip"; to: Orientation };
  /** Stickers posés sur la carte : dessinés sur la moitié de leur stage (si elle est visible). */
  stickers?: readonly StickerPlacement[];
  /** Seulement la moitié haute (carte au dernier stage ou qui reste en jeu : gain de place). */
  half?: boolean;
  /** Texte posé sur la carte : traduction (mode FR) ou ce qui manque pour payer. */
  note?: CardNote;
  /** Effets épuisés d'un stage (rang parmi ses effets) : barrés au feutre noir sur la carte. */
  exhausted?: (stage: StageId) => ExhaustedEffect[];
  /** Tremble « non » : cette carte interdit le geste tenté. */
  shake?: boolean;
  /** Cases à cocher d'une étape : croix sur les cochées, halo sur la prochaine d'une piste. */
  boxes?: (stage: StageId) => BoxView[];
  /** Cases à toucher pour répondre à la question en cours (identifiants des cases de l'étape visible en haut). */
  pickBoxes?: readonly string[];
  /** Icônes de coût rayées (clés `${étape}/${amélioration}/${indice}`) : croix au feutre. */
  crossedCosts?: readonly string[];
  /** Icônes de coût à toucher pour répondre à la question en cours (mêmes clés). */
  pickCosts?: readonly string[];
  /** Choisie pour un effet en cours (cible, carte à bloquer, coût) : contour vert et coche. */
  picked?: boolean;
};

/**
 * Traits de feutre sur le texte d'un effet épuisé : un trait par ligne, aux positions mesurées sur l'image
 * (data/textLines). Sans mesure, un trait estimé : texte des effets entre 27 % et 47 % de la hauteur (moitié haute),
 * entre 58 % et 88 % pour une face à image pleine, un effet par bande. La moitié basse est lue à l'envers.
 */
function Strikes({ template, full, stage, list, half }: { template: CardTemplate; full: boolean; stage: StageId | null; list: ExhaustedEffect[]; half: "top" | "bottom" }) {
  if (stage === null || list.length === 0) return null;
  const [from, to] = full ? [0.6, 0.86] : [0.28, 0.46];
  // Milieu des lettres : un peu sous le milieu de la ligne mesurée (qui compte les hampes des b, d, l).
  const place = (l: TextLine) => {
    const y = l[0] + 0.58 * (l[1] - l[0]);
    return half === "top" ? { y, x0: l[2], x1: l[3] } : { y: 1 - y, x0: 1 - l[3], x1: 1 - l[2] };
  };
  return (
    <>
      {list.flatMap(({ id, index, count, options }) => {
        const all = effectLines(template.expansion, template.serial, stage, id);
        // Effet à liste en partie épuisé : seulement les lignes des options épuisées (les dernières lignes de l'effet).
        const lines = options ? all?.filter((_, i) => options.done.includes(i - ((all?.length ?? 0) - options.count))) : all;
        if (options && !lines?.length) return [];
        if (lines?.length) {
          return lines.map(place).map((l, i) => (
            <span
              key={`${id}-${i}`}
              className={`${styles.strike} ${styles.strikeLine} ${half === "bottom" ? styles.strikeBottom : ""}`}
              style={{ top: `${l.y * 100}%`, left: `${l.x0 * 100}%`, width: `${(l.x1 - l.x0) * 100}%` }}
            />
          ));
        }
        const center = from + ((index + 0.5) * (to - from)) / count;
        const y = half === "top" ? center : 1 - center;
        return [<span key={id} className={`${styles.strike} ${half === "bottom" ? styles.strikeBottom : ""}`} style={{ top: `${y * 100}%` }} />];
      })}
    </>
  );
}

/**
 * Cases d'une moitié (positions mesurées, data/checkboxes) : croix au feutre sur les cases cochées, halo sur la
 * prochaine case d'une piste, contour clignotant sur les cases à toucher. La moitié basse est lue à l'envers.
 */
function Boxes({ template, stage, views, half, pick }: { template: CardTemplate; stage: StageId | null; views: BoxView[]; half: "top" | "bottom"; pick?: readonly string[] }) {
  if (stage === null || views.length === 0) return null;
  const rects = boxRects(template.expansion, template.serial, stage);
  if (!rects) return null;
  return (
    <>
      {views.map((v, i) => {
        const r = rects[i];
        if (!r) return null;
        const [x, y, w, h] = half === "top" ? r : [1 - r[0] - r[2], 1 - r[1] - r[3], r[2], r[3]];
        const style = { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` };
        const picking = half === "top" && (pick ?? []).includes(v.id);
        if (!v.checked && !v.next && !picking) return null;
        return (
          <span key={v.id} className={`${styles.box} ${v.checked ? styles.boxChecked : ""} ${v.next ? styles.boxNext : ""} ${picking ? styles.boxPick : ""}`} style={style} />
        );
      })}
    </>
  );
}

/** Icônes de coût d'amélioration (positions mesurées, data/upgradeIcons) : croix sur les rayées, contour sur celles à toucher. */
function CostIcons({ template, stage, half, crossed, pick }: { template: CardTemplate; stage: StageId | null; half: "top" | "bottom"; crossed: readonly string[]; pick: readonly string[] }) {
  if (stage === null) return null;
  const st = template.stages[String(stage) as "1"];
  if (!st) return null;
  return (
    <>
      {st.upgrades.flatMap((u) =>
        u.cost.map((_, i) => {
          const key = `${stage}/${u.id}/${i}`;
          const isCrossed = crossed.includes(key);
          const picking = pick.includes(key);
          const r = costIconRects(template.expansion, template.serial, stage, u.id)?.[i];
          if ((!isCrossed && !picking) || !r) return null;
          const [x, y, w, h] = half === "top" ? r : [1 - r[0] - r[2], 1 - r[1] - r[3], r[2], r[3]];
          return (
            <span
              key={key}
              className={`${styles.box} ${isCrossed ? styles.boxChecked : ""} ${picking ? styles.boxPick : ""}`}
              style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
            />
          );
        }),
      )}
    </>
  );
}

export type CardNote = { half: "top" | "bottom" | "full"; title?: string; text: string; tone: "fr" | "warn" };

const NOTE_PLACES = {
  top: { top: 0, height: "50%" },
  bottom: { top: "50%", height: "50%" },
  full: { top: 0, height: "100%" },
} as const;

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
  // « Stays in play » (sticker 7) : bandeau lisible au-dessus du texte des effets, pas dans la rangée des ressources.
  const stays = stickers.some((st) => st.stage === stage && st.staysInPlay);
  // Gloire (stickers 8, 10, 16) sur la ligne de la rosette de gloire ; ressources et mots-clés dans la rangée des ressources.
  const isFame = (st: StickerPlacement) => st.fame !== undefined && !st.resource;
  const own = [...stickers.filter((st) => st.stage === stage && !st.staysInPlay && !isFame(st)), ...stickers.filter((st) => st.stage === stage && isFame(st))];
  if (own.length === 0 && !stays) return null;
  const st0 = template.stages[String(stage) as "1"];
  const nFame = own.filter(isFame).length;
  const spots = [...stickerSpots(st0, own.length - nFame), ...fameStickerSpots(st0, nFame, fameSpot(template.expansion, template.serial, stage))];
  return (
    <>
      {stays && <StayBanner template={template} stage={stage} half={half} />}
      {own.map((st, i) => {
        const spot = spots[i];
        if (!spot) return null;
        const icon = stickerIcon(st);
        const size = (spot.size ?? STICKER_SIZE) * 100;
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

/**
 * Bandeau du sticker « Stays in play » : centré au-dessus du bloc d'effets (lignes mesurées sur l'image, sinon le haut
 * de la zone d'effet), comme le texte imprimé des cartes qui restent en jeu.
 */
function StayBanner({ template, stage, half }: { template: CardTemplate; stage: StageId; half: "top" | "bottom" }) {
  const st = template.stages[String(stage) as "1"];
  const lines = (st?.effects ?? []).flatMap((e) => effectLines(template.expansion, template.serial, stage, e.id) ?? []);
  const full = (["front", "back"] as const).some((side) => isFullImageFace(template, side) && [template.orientationToStage[`${side}-0`], template.orientationToStage[`${side}-180`]].includes(stage));
  const textTop = lines.length ? Math.min(...lines.map((l) => l[0])) : full ? 0.6 : 0.33;
  const center = lines.length ? (Math.min(...lines.map((l) => l[2])) + Math.max(...lines.map((l) => l[3]))) / 2 : 0.4;
  const height = 0.055;
  const top = Math.max(0.12, textTop - height - 0.008);
  const y = half === "top" ? top : 1 - top - height;
  const x = half === "top" ? center : 1 - center;
  return (
    <span className={`${styles.stayBanner} ${half === "bottom" ? styles.rotated : ""}`} style={{ top: `${y * 100}%`, left: `${x * 100}%`, height: `${height * 100}%` }}>
      <b className={styles.stayInfinity}>∞</b> Stays in play.
    </span>
  );
}

export const ANIM_MS = 700;

type Hover = { zone: ZoneKind; half: "top" | "bottom"; x: number; y: number };

/** Gloire variable : la valeur actuelle écrite sur la rosette « * » mesurée (demande du 2026-10-05). */
function FameNow({ template, stage, value }: { template: CardTemplate; stage: StageId; value: number }) {
  const spot = fameSpot(template.expansion, template.serial, stage);
  if (!spot) return null;
  const [cx, cy, d] = spot;
  const dh = (d * 373) / 520; // diamètre en part de la hauteur
  return (
    <span className={styles.fameNow} style={{ left: `${(cx - d / 2) * 100}%`, top: `${(cy - dh / 2) * 100}%`, width: `${d * 100}%` }} title={`Vaut ${value} gloire maintenant`}>
      {value}
    </span>
  );
}

/** Une face : image dans son orientation + numéros d'étape de chaque moitié. */
function Face({
  template,
  orientation,
  label,
  className,
  dimBottom,
  stickers,
  exhausted,
  boxes,
  pickBoxes,
  crossedCosts,
  pickCosts,
  goal,
  fameNow,
  customName,
}: {
  template: CardTemplate;
  orientation: Orientation;
  label: string;
  className?: string;
  /** Gloire que vaut maintenant l'étape du haut (gloire variable), écrite sur sa rosette « * ». */
  fameNow?: number;
  /** Nom donné par le joueur (Stranger), écrit sur le bandeau « ________ ». */
  customName?: string;
  dimBottom?: boolean;
  stickers?: readonly StickerPlacement[];
  exhausted?: (stage: StageId) => ExhaustedEffect[];
  boxes?: (stage: StageId) => BoxView[];
  pickBoxes?: readonly string[];
  crossedCosts?: readonly string[];
  pickCosts?: readonly string[];
  goal?: GoalView;
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
      {top !== null && (
        // Face à image pleine (une seule étape) : le numéro va dans le coin inférieur gauche.
        <span className={`${styles.stageNumber} ${bottom === null ? styles.stageCorner : styles.stageTop} ${styles[`stage${top}`]}`}>{top}</span>
      )}
      {bottom !== null && <span className={`${styles.stageNumber} ${styles.stageBottom} ${styles[`stage${bottom}`]}`}>{bottom}</span>}
      {exhausted && (
        <>
          <Strikes template={template} full={isFullImageFace(template, orientation.side)} stage={topId} list={topId === null ? [] : exhausted(topId)} half="top" />
          <Strikes template={template} full={false} stage={bottomId} list={bottomId === null ? [] : exhausted(bottomId)} half="bottom" />
        </>
      )}
      {stickers && stickers.length > 0 && (
        <>
          <Stickers template={template} stage={topId} stickers={stickers} half="top" />
          <Stickers template={template} stage={bottomId} stickers={stickers} half="bottom" />
        </>
      )}
      {boxes && (
        <>
          <Boxes template={template} stage={topId} views={topId === null ? [] : boxes(topId)} half="top" pick={pickBoxes} />
          <Boxes template={template} stage={bottomId} views={bottomId === null ? [] : boxes(bottomId)} half="bottom" />
        </>
      )}
      {((crossedCosts?.length ?? 0) > 0 || (pickCosts?.length ?? 0) > 0) && (
        <>
          <CostIcons template={template} stage={topId} half="top" crossed={crossedCosts ?? []} pick={pickCosts ?? []} />
          <CostIcons template={template} stage={bottomId} half="bottom" crossed={crossedCosts ?? []} pick={[]} />
        </>
      )}
      {goal && (
        <>
          {topId !== null && goal.stages.includes(topId) && <span className={`${styles.goalHalf} ${bottomId === null ? styles.goalFull : styles.goalTop}`} />}
          {bottomId !== null && goal.stages.includes(bottomId) && <span className={`${styles.goalHalf} ${styles.goalBottom}`} />}
          {goal.arrows.map((a) => {
            const r = ZONE_RECTS[a === "flip" ? "upgradeFlip" : "upgradeRotate"];
            return <span key={a} className={styles.goalUpgrade} style={{ left: `${r.left * 100}%`, top: `${r.top * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` }} />;
          })}
        </>
      )}
      {fameNow !== undefined && topId !== null && <FameNow template={template} stage={topId} value={fameNow} />}
      {customName && top !== null && /^_+$/.test(template.stages[String(topId) as "1"]?.name ?? "") && <span className={styles.customName}>{customName}</span>}
      {/* Grisé du bas par-dessus tout ce qui est posé sur cette moitié (stickers, traits). */}
      {dimBottom && top !== null && bottom !== null && <span className={styles.bottomShade} />}
    </div>
  );
}

export function CardView(props: Props) {
  const { id, template, orientation, label, width, selected, engaged, targetable, dimBottom, flagged, onTwoFinger, dimmed, badge, onTap, onLongPress, zoneLabel, anim, half, note, exhausted, shake, picked, boxes, pickBoxes, crossedCosts, pickCosts, goal } =
    props;
  // Carte rayée (demande du 2026-10-04) : glisser le doigt horizontalement sur la carte pose ou retire un halo rouge.
  const markId = props.markId ?? id;
  // Stickers toujours visibles (demande du 2026-10-05) : ceux de la carte de la partie, si l'appelant ne les donne pas.
  const ownStickers = useGame((g) => (markId && g.session ? g.session.states.at(-1)?.cards[markId]?.stickers : undefined));
  const stickers = props.stickers ?? ownStickers;
  // Stranger : le nom donné, écrit sur le blanc du bandeau.
  const customName = useGame((g) => (markId ? g.session?.states.at(-1)?.cards[markId]?.customName : undefined));
  // Gloire variable : seulement sur la face posée comme dans la partie (l'étape du haut est l'étape active).
  const fameNow = useGame((g) => {
    const s = g.session?.states.at(-1);
    const c = markId ? s?.cards[markId] : undefined;
    if (!g.session || !s || !c || c.orientation.side !== orientation.side || c.orientation.rotation !== orientation.rotation) return undefined;
    if (!kingdomCards(s).includes(c.instanceId) || !activeStage(g.session.catalog, s, c.instanceId)?.fameVariable) return undefined;
    return cardFame(g.session.catalog, s, c.instanceId);
  });
  const unwanted = useGame((g) => (markId ? (g.kingdom?.unwanted ?? []).includes(markId) : false));
  const toggleUnwanted = useGame((g) => g.toggleUnwanted);
  const onSwipe = markId && !anim ? () => toggleUnwanted(markId) : undefined;
  // Demi-carte : les positions touchées sont ramenées à la carte entière (zones cliquables inchangées).
  const yScale = half ? 0.5 : 1;
  const press = usePress(onTap ? (p) => onTap({ ...p, y: p.y * yScale }) : () => {}, onLongPress ? (p) => onLongPress({ ...p, y: p.y * yScale }) : undefined, onTwoFinger, onSwipe);
  const [hover, setHover] = useState<Hover | null>(null);
  const [clicked, setClicked] = useState(false); // pas de bulle après un clic, jusqu'à la sortie du pointeur
  const interactive = Boolean(onTap || onLongPress || onSwipe) && !anim;

  const action = hover && zoneLabel ? zoneLabel(hover.zone) : null;
  const fullImage = isFullImageFace(template, orientation.side);
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
    shake && !anim && styles.shake,
    picked && styles.picked,
    onSwipe && styles.swipeable,
    unwanted && styles.unwanted,
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
          <Face template={template} orientation={orientation} label={label} stickers={stickers} exhausted={exhausted} boxes={boxes} pickBoxes={pickBoxes} crossedCosts={crossedCosts} pickCosts={pickCosts} goal={goal} fameNow={fameNow} customName={customName} />
          <Face template={template} orientation={anim.to} label={label} className={styles.backFace} stickers={stickers} exhausted={exhausted} boxes={boxes} pickBoxes={pickBoxes} crossedCosts={crossedCosts} pickCosts={pickCosts} goal={goal} />
        </div>
      ) : (
        // Pendant une rotation, la carte n'est plus grisée (sinon la moitié grisée passe en haut).
        <Face template={template} orientation={orientation} label={label} dimBottom={dimBottom && !anim && !half} stickers={stickers} exhausted={exhausted} boxes={boxes} pickBoxes={pickBoxes} crossedCosts={crossedCosts} pickCosts={pickCosts} goal={goal} fameNow={fameNow} customName={customName} />
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
      {picked && <span className={styles.pickedMark} aria-hidden="true">✓</span>}
      {note && (
        <div
          className={`${styles.cardNote} ${note.tone === "warn" ? styles.cardNoteWarn : ""} ${(width ?? 200) < 160 ? styles.cardNoteBelow : ""}`}
          style={(width ?? 200) < 160 ? undefined : NOTE_PLACES[half ? "top" : note.half]}
          role="note"
        >
          {note.title && <strong>{note.title}</strong>}
          <IconText text={note.text} />
        </div>
      )}
    </div>
  );
}
