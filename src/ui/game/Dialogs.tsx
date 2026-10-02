import { useState } from "react";
import {
  activeStage,
  cardName,
  computeScore,
  instance,
  template,
  type Action,
  type Catalog,
  type GameState,
  type InstanceId,
} from "../../engine";
import { Dialog } from "../common/Dialog";
import { IconText } from "../common/IconText";
import { CardView } from "./CardView";
import styles from "./Game.module.css";

// Fenêtres de la partie : inspection, décisions en attente, défausse, fin de partie, confirmation.

export function Inspector({ catalog, state, card, onClose }: { catalog: Catalog; state: GameState; card: InstanceId; onClose: () => void }) {
  const t = template(catalog, instance(state, card).templateId);
  return (
    <Dialog title={`Inspection : ${cardName(catalog, state, card)}`} onClose={onClose} wide>
      <div className={styles.inspector}>
        {(["front", "back"] as const).map((side) => (
          <figure key={side}>
            <CardView template={t} orientation={{ side, rotation: 0 }} label={side === "front" ? "Recto" : "Verso"} />
            <figcaption>{side === "front" ? "Recto : stage 1 en haut, stage 2 tête en bas" : "Verso : stage 4 en haut, stage 3 tête en bas"}</figcaption>
          </figure>
        ))}
      </div>
      <p className={styles.muted}>Pince pour zoomer. L'orientation actuelle de la carte est celle du plateau.</p>
    </Dialog>
  );
}

export function DecisionDialog({ catalog, state, onAction }: { catalog: Catalog; state: GameState; onAction: (a: Action) => void }) {
  const p = state.pending;
  if (!p) return null;
  const tOf = (id: InstanceId) => template(catalog, instance(state, id).templateId);

  if (p.kind === "parchment") {
    const t = tOf(p.card);
    const stage = activeStage(catalog, state, p.card);
    return (
      <Dialog
        title={`Parchemin #${t.serial}`}
        wide
        actions={
          <button className="btn btn-primary" onClick={() => onAction({ type: "acknowledgeParchment" })}>
            J'ai lu, détruire le parchemin
          </button>
        }
      >
        <div className={styles.decisionRow}>
          <CardView template={t} orientation={{ side: "front", rotation: 0 }} label={`Parchemin #${t.serial}`} width={280} />
          <div className={styles.parchmentText}>
            <IconText text={stage?.text ?? ""} />
            {!catalog.parchments.has(t.id) && (
              <p className={styles.warning}>
                Ces instructions ne sont pas encore automatisées : applique-les toi-même (phase P3).
              </p>
            )}
          </div>
        </div>
      </Dialog>
    );
  }

  if (p.kind === "chooseSide") {
    const t = tOf(p.card);
    return (
      <Dialog title={`Carte #${t.serial} : choisis la face visible`} wide>
        <p>Ce choix est définitif : le numéro reste en haut quelle que soit la face.</p>
        <div className={styles.decisionRow}>
          {(["front", "back"] as const).map((side) => (
            <figure key={side} className={styles.choice}>
              <CardView template={t} orientation={{ side, rotation: 0 }} label={side} width={260} onTap={() => onAction({ type: "chooseSide", side })} />
              <button className="btn btn-primary" onClick={() => onAction({ type: "chooseSide", side })}>
                Garder {side === "front" ? "le recto" : "le verso"}
              </button>
            </figure>
          ))}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title={`Découverte : choisis ${p.remaining} carte${p.remaining > 1 ? "s" : ""}`} wide>
      <p>
        {p.leftovers === "destroy" ? "Les cartes non choisies seront détruites." : "Les cartes non choisies retournent dans la boîte."}
      </p>
      <div className={styles.decisionRow}>
        {p.options.map((id) => {
          const t = tOf(id);
          const picked = p.picked.includes(id);
          return (
            <figure key={id} className={styles.choice}>
              <div className={styles.bothSides}>
                <CardView template={t} orientation={{ side: "front", rotation: 0 }} label="Recto" width={170} />
                <CardView template={t} orientation={{ side: "back", rotation: 0 }} label="Verso" width={170} />
              </div>
              <button className="btn btn-primary" disabled={picked} onClick={() => onAction({ type: "chooseDiscovery", card: id })}>
                {picked ? "Choisie" : `Découvrir #${t.serial}`}
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
              width={150}
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
              <td>{l.variable ? "+ calcul à faire à la main" : ""}</td>
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
