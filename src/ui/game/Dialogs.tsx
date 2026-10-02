import { Fragment, useState, type ReactNode } from "react";
import {
  activeStage,
  canRestartKingdom,
  checkKey,
  isManualOpValid,
  printedStage,
  validOrientations,
  zoneOf,
  cardName,
  computeScore,
  instance,
  kingdomStats,
  stageIdAt,
  template,
  type Action,
  type Catalog,
  type GameState,
  type InstanceId,
  type ManualOp,
  type Zone,
} from "../../engine";
import type { Checkbox } from "../../data/schema";
import { STICKERS } from "../../data/stickers";
import { stageFr } from "../../data/translations";
import { Dialog } from "../common/Dialog";
import { Icon, IconText } from "../common/IconText";
import { CardView } from "./CardView";
import styles from "./Game.module.css";

// Fenêtres de la partie : inspection, décisions en attente, défausse, fin de partie, confirmation.

/** Largeur des cartes d'une liste (défausse) : environ 5 par rangée. */
function listCard(): number {
  return Math.floor(Math.max(180, Math.min(300, (Math.min(window.innerWidth, 1500) - 140) / 5)));
}

/** Largeur d'une grande carte dans une fenêtre : `count` cartes côte à côte, la plus grande qui tient. */
function bigCard(count = 1, reserved = 0): number {
  const byHeight = (window.innerHeight - 200 - reserved) * (373 / 520);
  const byWidth = (Math.min(window.innerWidth, 1500) - 120 - (count - 1) * 16) / count;
  return Math.floor(Math.max(150, Math.min(520, byHeight, byWidth)));
}

const ZONE_BUTTONS: readonly { label: string; to: Zone; position: "top" | "bottom" }[] = [
  { label: "En jeu", to: "play", position: "bottom" },
  { label: "Défausse", to: "discard", position: "bottom" },
  { label: "Pioche ↑", to: "deck", position: "top" },
  { label: "Pioche ↓", to: "deck", position: "bottom" },
  { label: "Permanentes", to: "permanent", position: "bottom" },
  { label: "Détruite", to: "destroyed", position: "bottom" },
  { label: "Boîte", to: "box", position: "bottom" },
];

/** Contenu d'une case à cocher : coût, gain, gloire ou marqueur imprimés. */
function checkboxText(b: Checkbox): string {
  // Longues suites d'une même ressource : « 7{sword} » plutôt que 7 icônes.
  const list = (rs: readonly string[]) => (rs.length > 2 && rs.every((r) => r === rs[0]) ? `${rs.length}{${rs[0] ?? ""}}` : rs.map((r) => `{${r}}`).join(""));
  const parts = [
    ...(b.cost?.length ? [list(b.cost)] : []),
    ...(b.gain?.length ? [`+${list(b.gain)}`] : []),
    ...(b.fame !== undefined ? [`{fame}${b.fame}`] : []),
    ...(b.icon ? [`{${b.icon}}`] : []),
  ];
  return parts.length ? parts.join(" ") : b.id;
}

/** Outils de résolution à la main d'une carte (spec 5.1) : orientation, zone, cases, stickers. */
function ManualTools({ catalog, state, card, onManual }: { catalog: Catalog; state: GameState; card: InstanceId; onManual: (op: ManualOp) => void }) {
  const c = instance(state, card);
  const t = template(catalog, c.templateId);
  const zone = zoneOf(state, card);
  const stage = activeStage(catalog, state, card);
  const valid = (op: ManualOp) => isManualOpValid(catalog, state, op);
  const stickers = STICKERS.filter((x) => x.expansion === t.expansion && (x.type === "resource" || x.type === "fame"));
  const onStage = stage ? c.stickers.filter((x) => x.stage === stage.id) : [];
  return (
    <div className={styles.manualTools}>
      <div className={styles.orientations}>
        {validOrientations(catalog, state, card).map((o) => {
          const sid = stageIdAt(t, o);
          const op: ManualOp = { kind: "orient", card, orientation: o };
          return (
            <CardView
              key={`${o.side}${o.rotation}`}
              template={t}
              orientation={o}
              label={`Étape ${sid === null ? "?" : printedStage(t, sid)}`}
              width={84}
              selected={o.side === c.orientation.side && o.rotation === c.orientation.rotation}
              onTap={valid(op) ? () => onManual(op) : undefined}
            />
          );
        })}
      </div>
      <div className={`${styles.segmented} ${styles.wrapSegmented}`}>
        {ZONE_BUTTONS.map((b) => {
          const op: ManualOp = { kind: "move", card, to: b.to, position: b.position };
          const here = zone === b.to && (b.to !== "deck" || state.zones.deck[b.position === "top" ? 0 : state.zones.deck.length - 1] === card);
          return (
            <button key={b.label} aria-pressed={here} disabled={here || !valid(op)} onClick={() => onManual(op)}>
              {b.label}
            </button>
          );
        })}
      </div>
      {stage && stage.checkboxes.length > 0 && (
        <div className={styles.toolRow}>
          {stage.checkboxes.map((b) => {
            const checked = c.checkedBoxes.includes(checkKey(stage.id, b.id));
            return (
              <button key={b.id} className={styles.checkbox} aria-pressed={checked} onClick={() => onManual({ kind: "check", card, box: b.id })}>
                <span>{checked ? "☑" : "☐"}</span> <IconText text={checkboxText(b)} />
              </button>
            );
          })}
        </div>
      )}
      {stage && (
        <div className={styles.toolRow}>
          {stickers.map((x) => {
            const op: ManualOp = { kind: "sticker", card, sticker: x.id, resource: x.resource ?? null, fame: x.type === "fame" ? (x.fame ?? 0) : null };
            return (
              <button key={x.id} className={styles.stickerBtn} disabled={!valid(op)} onClick={() => onManual(op)} title={`Sticker ${x.id}`}>
                <IconText text={x.resource ? `+{${x.resource}}` : `+{fame}${x.fame ?? 0}`} />
              </button>
            );
          })}
          {onStage.length > 0 && (
            <span className={styles.stickersOn}>
              <IconText text={onStage.map((x) => (x.resource ? `{${x.resource}}` : `{fame}${x.fame ?? 0}`)).join(" ")} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inspection : à gauche la carte telle qu'elle est posée, à droite l'autre face telle qu'on la voit en retournant
 * la carte de haut en bas (autre face, rotation inversée) : stage 1 en haut au recto ↔ stage 3 en haut au verso.
 * Avec `onManual`, les outils de résolution à la main s'affichent dessous.
 */
export function Inspector({
  catalog,
  state,
  card,
  onClose,
  onManual,
}: {
  catalog: Catalog;
  state: GameState;
  card: InstanceId;
  onClose: () => void;
  onManual?: (op: ManualOp) => void;
}) {
  const c = instance(state, card);
  const t = template(catalog, c.templateId);
  const other = { side: c.orientation.side === "front" ? "back" : "front", rotation: c.orientation.rotation === 0 ? 180 : 0 } as const;
  return (
    <Dialog title={cardName(catalog, state, card)} onClose={onClose} wide>
      <div className={styles.inspector}>
        <CardView template={t} orientation={c.orientation} label="Face visible" width={bigCard(2, onManual ? 300 : 0)} />
        <CardView template={t} orientation={other} label="Autre face" width={bigCard(2, onManual ? 300 : 0)} />
      </div>
      {onManual && <ManualTools catalog={catalog} state={state} card={card} onManual={onManual} />}
    </Dialog>
  );
}

/** Outils généraux à la main : ressources, découvrir ou retrouver une carte par son numéro. */
export function ManualDialog({
  catalog,
  state,
  onManual,
  onInspect,
  onClose,
}: {
  catalog: Catalog;
  state: GameState;
  onManual: (op: ManualOp) => void;
  onInspect: (card: InstanceId) => void;
  onClose: () => void;
}) {
  const [serialText, setSerialText] = useState("");
  const serial = serialText === "" ? null : Number.parseInt(serialText, 10);
  const found = serial === null ? undefined : Object.values(state.cards).find((x) => x.serial === serial);
  const discoverOp: ManualOp | null = found ? { kind: "discover", card: found.instanceId } : null;
  return (
    <Dialog title="À la main" onClose={onClose}>
      <div className={styles.manualResources}>
        {catalog.resources.map((r) => {
          const n = state.resources[r] ?? 0;
          return (
            <div key={r} className={styles.manualResource}>
              <Icon id={r} />
              <button className={styles.iconBtn} disabled={n === 0} onClick={() => onManual({ kind: "resource", resource: r, delta: -1 })} aria-label={`Retirer ${r}`}>
                −
              </button>
              <span className={styles.zoneValue}>{n}</span>
              <button className={styles.iconBtn} onClick={() => onManual({ kind: "resource", resource: r, delta: 1 })} aria-label={`Ajouter ${r}`}>
                +
              </button>
            </div>
          );
        })}
      </div>
      <div className={styles.manualFind}>
        <input inputMode="numeric" placeholder="N°" value={serialText} onChange={(e) => setSerialText(e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Numéro de carte" />
        <button className="btn btn-primary" disabled={!discoverOp || !isManualOpValid(catalog, state, discoverOp)} onClick={() => discoverOp && onManual(discoverOp)}>
          Découvrir
        </button>
        <button className="btn" disabled={!found} onClick={() => found && onInspect(found.instanceId)}>
          🔍
        </button>
        {found && <span className={styles.zoneValue}>{ZONE_NAMES[zoneOf(state, found.instanceId)]}</span>}
      </div>
    </Dialog>
  );
}

const ZONE_NAMES: Record<Zone, string> = {
  box: "Boîte",
  deck: "Pioche",
  play: "En jeu",
  discard: "Défausse",
  permanent: "Permanentes",
  destroyed: "Détruite",
};

export function DecisionDialog({
  catalog,
  state,
  onAction,
  onRestart,
}: {
  catalog: Catalog;
  state: GameState;
  onAction: (a: Action) => void;
  onRestart: () => void;
}) {
  const p = state.pending;
  if (!p) return null;
  const tOf = (id: InstanceId) => template(catalog, instance(state, id).templateId);

  if (p.kind === "parchment") {
    const t = tOf(p.card);
    // Carte 23 : on regarde les cartes 24 à 27, puis on recommence le royaume ou on continue.
    const resetPoint = t.serial === 23 && canRestartKingdom(state);
    const preview = resetPoint ? state.zones.box.filter((id) => [24, 25, 26, 27].includes(instance(state, id).serial)) : [];
    const width = bigCard(1 + preview.length);
    return (
      <Dialog
        title={`Parchemin #${t.serial}`}
        wide
        actions={
          <>
            {resetPoint && (
              <button className="btn" onClick={onRestart}>
                ↺ Recommencer le royaume
              </button>
            )}
            <button className="btn btn-primary" onClick={() => onAction({ type: "acknowledgeParchment" })}>
              Continuer
            </button>
          </>
        }
      >
        <div className={styles.decisionRow}>
          <CardView template={t} orientation={{ side: "front", rotation: 0 }} label={`Parchemin #${t.serial}`} width={width} />
          {preview.map((id) => (
            <CardView key={id} template={tOf(id)} orientation={{ side: "front", rotation: 0 }} label={`#${instance(state, id).serial}`} width={width} />
          ))}
          {!catalog.parchments.has(t.id) && <p className={styles.warning}>À appliquer à la main</p>}
        </div>
      </Dialog>
    );
  }

  if (p.kind === "chooseSide") {
    const t = tOf(p.card);
    return (
      <Dialog title={`Carte #${t.serial}`} wide>
        <div className={styles.decisionRow}>
          {(["front", "back"] as const).map((side) => (
            <figure key={side} className={styles.choice}>
              <CardView template={t} orientation={{ side, rotation: 0 }} label={side} width={bigCard(2)} onTap={() => onAction({ type: "chooseSide", side })} />
              <button className="btn btn-primary" onClick={() => onAction({ type: "chooseSide", side })}>
                {side === "front" ? "Recto" : "Verso"}
              </button>
            </figure>
          ))}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title={`Découvrir ${p.remaining} carte${p.remaining > 1 ? "s" : ""}`} wide>
      <div className={styles.decisionRow}>
        {p.options.map((id) => {
          const t = tOf(id);
          const picked = p.picked.includes(id);
          return (
            <figure key={id} className={styles.choice}>
              <div className={styles.bothSides}>
                <CardView template={t} orientation={{ side: "front", rotation: 0 }} label="Recto" width={bigCard(p.options.length * 2)} />
                <CardView template={t} orientation={{ side: "back", rotation: 0 }} label="Verso" width={bigCard(p.options.length * 2)} />
              </div>
              <button className="btn btn-primary" disabled={picked} onClick={() => onAction({ type: "chooseDiscovery", card: id })}>
                {picked ? "Choisie" : `#${t.serial}`}
              </button>
            </figure>
          );
        })}
      </div>
    </Dialog>
  );
}

export function CardListDialog({
  catalog,
  state,
  title,
  cards,
  onInspect,
  onClose,
}: {
  catalog: Catalog;
  state: GameState;
  title: string;
  cards: InstanceId[];
  onInspect: (id: InstanceId) => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={`${title} (${cards.length})`} onClose={onClose} wide>
      {cards.length === 0 ? (
        <p className={styles.muted}>Aucune carte.</p>
      ) : (
        <div className={styles.cardList}>
          {[...cards].reverse().map((id) => (
            <CardView
              key={id}
              template={template(catalog, instance(state, id).templateId)}
              orientation={instance(state, id).orientation}
              label={cardName(catalog, state, id)}
              width={listCard()}
              onTap={() => onInspect(id)}
              onLongPress={() => onInspect(id)}
            />
          ))}
        </div>
      )}
    </Dialog>
  );
}

export function EndDialog({ catalog, state, onBack, onClose }: { catalog: Catalog; state: GameState; onBack: () => void; onClose: () => void }) {
  const score = computeScore(catalog, state);
  const lines = score.lines.filter((l) => l.fame !== 0 || l.variable).sort((a, b) => b.fame - a.fame);
  return (
    <Dialog
      title="Fin de la partie"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Voir le royaume
          </button>
          <button className="btn btn-primary" onClick={onBack}>
            Retour aux royaumes
          </button>
        </>
      }
    >
      <p className={styles.bigScore}>
        <IconText text={`${score.total} {fame}`} />
      </p>
      <table className={styles.scoreTable}>
        <tbody>
          {lines.map((l) => (
            <tr key={l.card}>
              <td>{l.name}</td>
              <td>{l.fame}</td>
              <td>{l.variable ? "+ ?" : ""}</td>
            </tr>
          ))}
          {score.purgedFame > 0 && (
            <tr>
              <td>Gloire purgée</td>
              <td>{score.purgedFame}</td>
              <td />
            </tr>
          )}
        </tbody>
      </table>
    </Dialog>
  );
}

export function ConfirmDialog({ message, confirm, onConfirm, onCancel }: { message: string; confirm: string; onConfirm: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title="Confirmer"
      onClose={onCancel}
      actions={
        <>
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onConfirm();
            }}
          >
            {confirm}
          </button>
        </>
      }
    >
      <p>
        <IconText text={message} />
      </p>
    </Dialog>
  );
}

/** Fenêtre « Stats » : composition et production du royaume. */
export function StatsDialog({ catalog, state, onClose }: { catalog: Catalog; state: GameState; onClose: () => void }) {
  const st = kingdomStats(catalog, state);
  // Couleur de chaque case selon ce qu'elle compte (ressource, étape, type de carte).
  const cell = (label: ReactNode, value: number, tone?: string) => (
    <div className={styles.statCell} style={tone ? { background: `color-mix(in srgb, ${tone} 22%, var(--surface))`, borderColor: tone } : undefined}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
  return (
    <Dialog title="Stats du royaume" onClose={onClose} wide>
      <div className={styles.stats}>
        <section>
          <h3>Cartes</h3>
          <div className={styles.statGrid}>
            {cell("Total", st.cards.total, "var(--accent)")}
            {cell("Deck", st.cards.deck)}
            {cell("En jeu", st.cards.play)}
            {cell("Défausse", st.cards.discard)}
            {cell("Permanentes", st.cards.permanent)}
          </div>
        </section>
        <section>
          <h3>Étapes</h3>
          <div className={styles.statGrid}>
            {([1, 2, 3, 4] as const).map((n) => (
              <Fragment key={n}>{cell(`Étape ${n}`, st.stages[n], STAGE_TONES[n])}</Fragment>
            ))}
          </div>
        </section>
        <section>
          <h3>Production</h3>
          <div className={styles.statGrid}>
            {catalog.resources.map((r) => (
              <Fragment key={r}>{cell(<Icon id={r} />, st.production[r] ?? 0, RESOURCE_TONES[r])}</Fragment>
            ))}
            {st.flexible > 0 && cell("Au choix", st.flexible)}
          </div>
        </section>
        <section>
          <h3>Gloire</h3>
          <div className={styles.statGrid}>{cell(<Icon id="fame" />, st.fame, "#e3b505")}</div>
        </section>
        <section>
          <h3>Types</h3>
          <div className={styles.statGrid}>
            {st.keywords.map(([k, n]) => (
              <Fragment key={k}>{cell(k, n, KEYWORD_TONES[k])}</Fragment>
            ))}
          </div>
        </section>
        <section>
          <h3>Boîte</h3>
          <div className={styles.statGrid}>
            {cell("Découvertes", st.discovered)}
            {cell("Détruites", st.destroyed)}
            {cell("Dans la boîte", st.inBox)}
          </div>
        </section>
      </div>
    </Dialog>
  );
}

const STAGE_TONES: Record<1 | 2 | 3 | 4, string> = { 1: "#2e8b3d", 2: "#e3b505", 3: "#e07b1a", 4: "#c62828" };

const RESOURCE_TONES: Record<string, string> = {
  coin: "#e3b505",
  wood: "#8b5a2b",
  stone: "#6f8f80",
  metal: "#9aa3ad",
  sword: "#5f6b78",
  tradeGood: "#b5651d",
};

// Types en anglais (texte des cartes), couleur du bandeau (spec 7.4).
const KEYWORD_TONES: Record<string, string> = {
  Land: "var(--cat-land)",
  Building: "var(--cat-building)",
  Person: "var(--cat-person)",
  Livestock: "var(--cat-livestock)",
  Seafaring: "var(--cat-seafaring)",
  Event: "var(--cat-other)",
  Enemy: "var(--cat-negative)",
  Goal: "var(--cat-goal)",
};

/** Bulle de traduction d'une moitié de carte (toucher hors des zones d'action, infobulles FR activées). */
export function TranslationBubble({
  catalog,
  state,
  card,
  half,
  x,
  y,
}: {
  catalog: Catalog;
  state: GameState;
  card: InstanceId;
  half: "top" | "bottom";
  x: number;
  y: number;
}) {
  const c = instance(state, card);
  const t = template(catalog, c.templateId);
  const o = half === "top" ? c.orientation : { side: c.orientation.side, rotation: c.orientation.rotation === 0 ? 180 : 0 } as const;
  const stageId = stageIdAt(t, o);
  const fr = stageId ? stageFr(t.id, stageId) : undefined;
  if (!fr) return null;
  const stage = stageId ? t.stages[String(stageId) as "1" | "2" | "3" | "4"] : undefined;
  return (
    <div className={styles.tooltip} style={{ left: Math.min(x + 12, window.innerWidth - 336), top: Math.min(y + 12, window.innerHeight - 180) }} role="tooltip">
      <strong>
        {fr.name || stage?.name}
        {stage?.name && fr.name !== stage.name ? <small> ({stage.name})</small> : null}
      </strong>
      {fr.text && (
        <p>
          <IconText text={fr.text} />
        </p>
      )}
    </div>
  );
}
