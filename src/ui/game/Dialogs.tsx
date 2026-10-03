import { Fragment, useState, type ReactNode } from "react";
import {
  availableExpansions,
  canRestartKingdom,
  EXPANSION_SERIALS,
  exhaustedEffects,
  expansionName,
  cardName,
  computeScore,
  instance,
  kingdomStats,
  template,
  type Action,
  type Answer,
  type Catalog,
  type GameState,
  type InstanceId,
} from "../../engine";
import type { StageId } from "../../data/schema";
import { Dialog } from "../common/Dialog";
import { Icon, IconText } from "../common/IconText";
import { CardView, type CardNote } from "./CardView";
import { frNote } from "./translationNote";
import { usePrefs } from "../common/prefs";
import type { TapPoint } from "../common/usePress";
import styles from "./Game.module.css";

// Fenêtres de la partie : inspection, décisions en attente, défausse, fin de partie, confirmation.

/** Effets épuisés d'une carte, à barrer partout où elle est dessinée. */
const exhaustedOf = (catalog: Catalog, state: GameState, id: InstanceId) => (stage: StageId) => exhaustedEffects(catalog, state, id, stage);

/** Largeur des cartes d'une liste (défausse) : environ 5 par rangée. */
function listCard(): number {
  return Math.floor(Math.max(180, Math.min(300, (Math.min(window.innerWidth, 1500) - 140) / 5)));
}

/** Largeur d'une carte d'un choix de découverte à 2 cartes (recto + verso) par rangée, 2 rangées visibles. */
function pairWidth(): number {
  const byWidth = (Math.min(window.innerWidth, 1500) - 140 - 3 * 16) / 4;
  const byHeight = ((window.innerHeight - 300) / 2) * (373 / 520);
  return Math.floor(Math.max(130, Math.min(320, byWidth, byHeight)));
}

/** Largeur des cartes empilées en rangées (recto + verso par rangée) : toutes les rangées tiennent sans défiler. */
function stackedWidth(rows: number): number {
  const byHeight = ((window.innerHeight - 230 - (rows - 1) * 16) / Math.max(1, rows)) * (373 / 520);
  const byWidth = (Math.min(window.innerWidth, 1500) - 140 - 16) / 2;
  return Math.floor(Math.max(120, Math.min(420, byHeight, byWidth)));
}

/** Largeur d'une grande carte dans une fenêtre : `count` cartes côte à côte, la plus grande qui tient. */
function bigCard(count = 1): number {
  const byHeight = (window.innerHeight - 200) * (373 / 520);
  const byWidth = (Math.min(window.innerWidth, 1500) - 120 - (count - 1) * 16) / count;
  return Math.floor(Math.max(150, Math.min(520, byHeight, byWidth)));
}

/**
 * Inspection : à gauche la carte telle qu'elle est posée, à droite l'autre face, même sens : stage 1 à côté du 4,
 * stage 2 à côté du 3, à l'envers (demande du 2026-10-02, qui remplace la rotation inversée).
 */
export function Inspector({ catalog, state, card, onClose }: { catalog: Catalog; state: GameState; card: InstanceId; onClose: () => void }) {
  const c = instance(state, card);
  const t = template(catalog, c.templateId);
  const other = { side: c.orientation.side === "front" ? "back" : "front", rotation: c.orientation.rotation } as const;
  // Mode FR : toucher une moitié pose sa traduction sur la carte ; toucher à nouveau l'enlève.
  const tooltipsFr = usePrefs((p) => p.tooltipsFr);
  const [note, setNote] = useState<{ face: 0 | 1; note: CardNote } | null>(null);
  const tap = (face: 0 | 1, o: typeof c.orientation) => (p: TapPoint) => {
    if (!tooltipsFr) return;
    const n = frNote(t, o, p.y < 0.5 ? "top" : "bottom");
    setNote(n && !(note?.face === face && note.note.half === n.half) ? { face, note: n } : null);
  };
  // Carte permanente dont on a choisi la face (objectifs…) : l'autre face ne servira plus, on ne la montre pas.
  const single = t.chooseSideOnDiscover && state.zones.permanent.includes(card);
  return (
    <Dialog title={cardName(catalog, state, card)} onClose={onClose} wide>
      <div className={styles.inspector}>
        <CardView
          template={t}
          orientation={c.orientation}
          label="Face visible"
          width={bigCard(single ? 1 : 2)}
          stickers={c.stickers}
          onTap={tap(0, c.orientation)}
          exhausted={(stage) => exhaustedEffects(catalog, state, card, stage)}
          note={tooltipsFr && note?.face === 0 ? note.note : undefined}
        />
        {!single && (
          <CardView
            template={t}
            orientation={other}
            label="Autre face"
            width={bigCard(2)}
            stickers={c.stickers}
            onTap={tap(1, other)}
            exhausted={(stage) => exhaustedEffects(catalog, state, card, stage)}
            note={tooltipsFr && note?.face === 1 ? note.note : undefined}
          />
        )}
      </div>
    </Dialog>
  );
}

export function DecisionDialog({
  catalog,
  state,
  onAction,
  onRestart,
  onInspect,
}: {
  catalog: Catalog;
  state: GameState;
  onAction: (a: Action) => void;
  onRestart: () => void;
  onInspect: (card: InstanceId) => void;
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
            <CardView key={id} template={tOf(id)} orientation={{ side: "front", rotation: 0 }} label={`#${instance(state, id).serial}`} width={width} exhausted={exhaustedOf(catalog, state, id)} />
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
              <CardView template={t} orientation={{ side, rotation: 0 }} label={side} width={bigCard(2)} onTap={() => onAction({ type: "chooseSide", side })} exhausted={exhaustedOf(catalog, state, p.card)} />
              <button className="btn btn-primary" onClick={() => onAction({ type: "chooseSide", side })}>
                {side === "front" ? "Recto" : "Verso"}
              </button>
            </figure>
          ))}
        </div>
      </Dialog>
    );
  }

  if (p.kind === "newCards") {
    // Recto et verso de chaque carte côte à côte, les cartes l'une au-dessus de l'autre (demande du 2026-10-03).
    const width = stackedWidth(p.cards.length);
    return (
      <Dialog
        title={p.cards.length > 1 ? "Nouvelles cartes" : "Nouvelle carte"}
        wide
        actions={
          <button className="btn btn-primary" onClick={() => onAction({ type: "acknowledgeDiscoveries" })}>
            {/* Début de manche : les cartes vont être mélangées ; découverte par un effet : elles sont dans la défausse. */}
            {state.queue[0]?.kind === "shuffle" ? "Mélanger dans le deck" : "Ajouter au deck"}
          </button>
        }
      >
        <div className={styles.newCards}>
          {p.cards.map((id) => (
            <div key={id} className={styles.bothSides}>
              {(["front", "back"] as const).map((side) => (
                <CardView
                  key={side}
                  template={tOf(id)}
                  orientation={{ side, rotation: 0 }}
                  label={side === "front" ? "Recto" : "Verso"}
                  width={width}
                  onLongPress={() => onInspect(id)}
                  exhausted={exhaustedOf(catalog, state, id)}
                />
              ))}
            </div>
          ))}
        </div>
      </Dialog>
    );
  }

  if (p.kind === "choice") return <ChoiceDialog key={`${p.source}/${p.script}/${p.answers.length}`} catalog={catalog} state={state} onAction={onAction} />;

  return (
    <Dialog title={`Découvrir ${p.remaining} carte${p.remaining > 1 ? "s" : ""}`} wide>
      <div className={`${styles.decisionRow} ${p.options.length > 2 ? styles.twoPerRow : ""}`}>
        {p.options.map((id) => {
          const t = tOf(id);
          const picked = p.picked.includes(id);
          // Plus de 2 cartes : 2 par rangée (recto + verso de chacune), rangées qui défilent (demande du 2026-10-02).
          const width = p.options.length > 2 ? pairWidth() : bigCard(p.options.length * 2);
          return (
            <figure key={id} className={styles.choice}>
              <div className={styles.bothSides}>
                <CardView template={t} orientation={{ side: "front", rotation: 0 }} label="Recto" width={width} onLongPress={() => onInspect(id)} exhausted={exhaustedOf(catalog, state, id)} />
                <CardView template={t} orientation={{ side: "back", rotation: 0 }} label="Verso" width={width} onLongPress={() => onInspect(id)} exhausted={exhaustedOf(catalog, state, id)} />
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
              exhausted={exhaustedOf(catalog, state, id)}
            />
          ))}
        </div>
      )}
    </Dialog>
  );
}

/** Question posée par un effet (spec 4.1) : cartes, ressources ou option. */
function ChoiceDialog({ catalog, state, onAction }: { catalog: Catalog; state: GameState; onAction: (a: Action) => void }) {
  const p = state.pending;
  const [cards, setCards] = useState<InstanceId[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  if (p?.kind !== "choice") return null;
  const req = p.request;
  const answer = (a: Answer) => {
    setCards([]);
    setResources([]);
    onAction({ type: "choose", answer: a });
  };
  const source = state.cards[p.source];
  const sourceView = source && (
    <CardView template={template(catalog, source.templateId)} orientation={source.orientation} label={cardName(catalog, state, p.source)} width={150} exhausted={exhaustedOf(catalog, state, p.source)} />
  );
  const cancel = p.cancellable && (
    <button className="btn" onClick={() => onAction({ type: "cancelChoice" })}>
      Annuler
    </button>
  );
  const one = req.type === "cards" && req.min === 1 && req.max === 1;
  const ok =
    req.type === "cards" ? cards.length >= req.min && cards.length <= req.max : req.type === "resources" ? resources.length === req.count : false;
  const actions = (
    <>
      {cancel}
      {(req.type === "resources" || (req.type === "cards" && !one)) && (
        <button
          className="btn btn-primary"
          disabled={!ok}
          onClick={() => answer(req.type === "cards" ? { cards } : { resources })}
        >
          Valider
        </button>
      )}
    </>
  );
  return (
    <Dialog title={cardName(catalog, state, p.source)} wide actions={actions}>
      <div className={styles.choiceHead}>
        {sourceView}
        <p className={styles.choicePrompt}>
          <IconText text={req.prompt} />
          {req.type === "cards" && !one && (
            <small>
              {" "}
              ({cards.length} / {req.min === req.max ? req.max : `${req.min}–${req.max}`})
            </small>
          )}
        </p>
      </div>
      {req.type === "option" && (
        <div className={styles.choiceOptions}>
          {req.labels.map((label, i) => (
            <button key={i} className="btn btn-primary" onClick={() => answer({ option: i })}>
              <IconText text={label} />
            </button>
          ))}
        </div>
      )}
      {req.type === "resources" && (
        <>
          <div className={styles.choiceOptions}>
            {req.options.map((r) => (
              <button
                key={r}
                className={styles.resourcePick}
                disabled={resources.length >= req.count}
                onClick={() => {
                  const next = [...resources, r];
                  if (req.count === 1) answer({ resources: next });
                  else setResources(next);
                }}
                aria-label={r}
              >
                <Icon id={r} />
              </button>
            ))}
          </div>
          {req.count > 1 && (
            <div className={styles.choiceOptions}>
              {resources.map((r, i) => (
                <button key={i} className={styles.resourcePicked} onClick={() => setResources(resources.filter((_, j) => j !== i))} aria-label={`Retirer ${r}`}>
                  <Icon id={r} />
                </button>
              ))}
              {Array.from({ length: req.count - resources.length }, (_, i) => (
                <span key={`e${i}`} className={styles.resourceSlot} />
              ))}
            </div>
          )}
        </>
      )}
      {req.type === "cards" && (
        <div className={styles.cardList}>
          {req.options.map((id) => {
            const picked = cards.includes(id);
            return (
              <CardView
                key={id}
                template={template(catalog, instance(state, id).templateId)}
                orientation={instance(state, id).orientation}
                label={cardName(catalog, state, id)}
                width={listCard()}
                selected={picked}
                exhausted={exhaustedOf(catalog, state, id)}
                onTap={() => {
                  if (one) return answer({ cards: [id] });
                  if (picked) setCards(cards.filter((c) => c !== id));
                  else if (cards.length < req.max) setCards([...cards, id]);
                }}
              />
            );
          })}
        </div>
      )}
    </Dialog>
  );
}

export function EndDialog({
  catalog,
  state,
  onBack,
  onClose,
  onAction,
}: {
  catalog: Catalog;
  state: GameState;
  onBack: () => void;
  onClose: () => void;
  onAction: (a: Action) => void;
}) {
  const score = computeScore(catalog, state);
  const lines = score.lines.filter((l) => l.fame !== 0 || l.variable).sort((a, b) => b.fame - a.fame);
  const camp = state.campaign;
  // Mini-extensions (spec 4.7) : 136, 137, 138, une seule fois par royaume ; celles déjà jouées sont grisées.
  const available = new Set(availableExpansions(state));
  const expansions = Object.values(state.cards)
    .filter((c) => (EXPANSION_SERIALS as readonly number[]).includes(c.serial))
    .sort((a, b) => a.serial - b.serial);
  return (
    <Dialog
      title={camp?.played.length ? "Fin de la mini-extension" : "Fin de la partie"}
      onClose={onClose}
      wide
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
      {camp && camp.base !== null && (
        <ol className={styles.scorePath} aria-label="Chemin de score">
          <li>
            <span>Partie de base</span> <IconText text={`${camp.base} {fame}`} />
          </li>
          {camp.played.map((p) => (
            <li key={p.serial}>
              <span>{p.name}</span> <IconText text={`${p.score} {fame}`} />
            </li>
          ))}
        </ol>
      )}
      <div className={styles.expansionChoice}>
        {expansions.map((c) => {
          const name = expansionName({ catalog, s: state }, c.instanceId);
          const open = available.has(c.instanceId);
          return (
            <figure key={c.instanceId} className={`${styles.choice} ${open ? "" : styles.expansionDone}`}>
              <CardView template={template(catalog, c.templateId)} orientation={{ side: "front", rotation: 0 }} label={name} width={150} />
              <button className="btn btn-primary" disabled={!open} onClick={() => onAction({ type: "startExpansion", card: c.instanceId })}>
                {open ? `Jouer ${name}` : "Déjà jouée"}
              </button>
            </figure>
          );
        })}
      </div>
      <table className={styles.scoreTable}>
        <tbody>
          {lines.map((l) => (
            <tr key={l.card}>
              <td>{l.name}</td>
              <td>{l.fame}</td>
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
export function StatsDialog({
  catalog,
  state,
  onClose,
  onShowDestroyed,
  onInspect,
}: {
  catalog: Catalog;
  state: GameState;
  onClose: () => void;
  onShowDestroyed: () => void;
  onInspect: (card: InstanceId) => void;
}) {
  const st = kingdomStats(catalog, state);
  const [allCards, setAllCards] = useState(false);
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
            <button className={styles.statButton} onClick={() => setAllCards((o) => !o)} aria-pressed={allCards}>
              {cell("Découvertes", st.discovered)}
            </button>
            <button className={styles.statButton} onClick={onShowDestroyed} disabled={st.destroyed === 0}>
              {cell("Détruites", st.destroyed)}
            </button>
            {cell("Dans la boîte", st.inBox)}
          </div>
          {allCards && <CardNumbers catalog={catalog} state={state} onInspect={onInspect} />}
        </section>
      </div>
    </Dialog>
  );
}

/**
 * Toutes les cartes de l'extension par numéro (demande du 2026-10-03) : vert découverte (dans le royaume), rouge
 * détruite, gris encore dans la boîte. Toucher une carte connue l'inspecte.
 */
function CardNumbers({ catalog, state, onInspect }: { catalog: Catalog; state: GameState; onInspect: (card: InstanceId) => void }) {
  const cards = Object.values(state.cards).sort((a, b) => a.serial - b.serial);
  const status = (id: InstanceId): "known" | "destroyed" | "unknown" => {
    if (state.zones.destroyed.includes(id)) return "destroyed";
    return state.zones.box.includes(id) ? "unknown" : "known";
  };
  return (
    <div className={styles.cardNumbers}>
      {cards.map((c) => {
        const s = status(c.instanceId);
        const label = s === "unknown" ? `#${c.serial}` : `#${c.serial} ${cardName(catalog, state, c.instanceId)}`;
        return (
          <button
            key={c.instanceId}
            className={`${styles.cardNumber} ${styles[`cardNumber_${s}`]}`}
            disabled={s === "unknown"}
            onClick={() => onInspect(c.instanceId)}
            aria-label={label}
          >
            {c.serial}
          </button>
        );
      })}
    </div>
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
