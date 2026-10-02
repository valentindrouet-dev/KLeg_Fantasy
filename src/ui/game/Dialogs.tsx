import { Fragment, useState, type ReactNode } from "react";
import {
  canRestartKingdom,
  cardName,
  computeScore,
  instance,
  kingdomStats,
  template,
  type Action,
  type Catalog,
  type GameState,
  type InstanceId,
} from "../../engine";
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
function bigCard(count = 1): number {
  const byHeight = (window.innerHeight - 200) * (373 / 520);
  const byWidth = (Math.min(window.innerWidth, 1500) - 120 - (count - 1) * 16) / count;
  return Math.floor(Math.max(150, Math.min(520, byHeight, byWidth)));
}

/**
 * Inspection : à gauche la carte telle qu'elle est posée, à droite l'autre face telle qu'on la voit en retournant
 * la carte de haut en bas (autre face, rotation inversée) : stage 1 en haut au recto ↔ stage 3 en haut au verso.
 */
export function Inspector({ catalog, state, card, onClose }: { catalog: Catalog; state: GameState; card: InstanceId; onClose: () => void }) {
  const c = instance(state, card);
  const t = template(catalog, c.templateId);
  const other = { side: c.orientation.side === "front" ? "back" : "front", rotation: c.orientation.rotation === 0 ? 180 : 0 } as const;
  return (
    <Dialog title={cardName(catalog, state, card)} onClose={onClose} wide>
      <div className={styles.inspector}>
        <CardView template={t} orientation={c.orientation} label="Face visible" width={bigCard(2)} />
        <CardView template={t} orientation={other} label="Autre face" width={bigCard(2)} />
      </div>
    </Dialog>
  );
}

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

const KEYWORDS_FR: Record<string, string> = {
  Land: "Terres",
  Building: "Bâtiments",
  Person: "Personnes",
  Livestock: "Bétail",
  Seafaring: "Maritime",
  Event: "Événements",
  Enemy: "Ennemis",
  Goal: "Objectifs",
  State: "États",
  Knight: "Chevaliers",
};

/** Fenêtre « Stats » : composition et production du royaume. */
export function StatsDialog({ catalog, state, onClose }: { catalog: Catalog; state: GameState; onClose: () => void }) {
  const st = kingdomStats(catalog, state);
  const cell = (label: ReactNode, value: number) => (
    <div className={styles.statCell}>
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
            {cell("Total", st.cards.total)}
            {cell("Deck", st.cards.deck)}
            {cell("En jeu", st.cards.play)}
            {cell("Défausse", st.cards.discard)}
            {cell("Permanentes", st.cards.permanent)}
          </div>
        </section>
        <section>
          <h3>Production</h3>
          <div className={styles.statGrid}>
            {catalog.resources.map((r) => (
              <Fragment key={r}>{cell(<Icon id={r} />, st.production[r] ?? 0)}</Fragment>
            ))}
            {st.flexible > 0 && cell("Au choix", st.flexible)}
          </div>
        </section>
        <section>
          <h3>Gloire</h3>
          <div className={styles.statGrid}>{cell(<Icon id="fame" />, st.fame)}</div>
        </section>
        <section>
          <h3>Types</h3>
          <div className={styles.statGrid}>
            {st.keywords.map(([k, n]) => (
              <Fragment key={k}>{cell(KEYWORDS_FR[k] ?? k, n)}</Fragment>
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
