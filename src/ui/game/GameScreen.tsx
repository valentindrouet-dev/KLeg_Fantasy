import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAction,
  canUndo,
  cardName,
  computeScore,
  current,
  getLegalActions,
  instance,
  template,
  totalResources,
  usableEffects,
  type Action,
  type Catalog,
  type GameState,
  type InstanceId,
} from "../../engine";
import { Icon, IconText } from "../common/IconText";
import { CardActions } from "./CardActions";
import { CardView } from "./CardView";
import { CardListDialog, ConfirmDialog, DecisionDialog, EndDialog, Inspector } from "./Dialogs";
import { useGame } from "./store";
import { useFitCards } from "./useFitCards";
import styles from "./Game.module.css";

// Plateau de jeu (spec 7.3) : deck à gauche, zone de jeu au centre, défausse à droite,
// ressources et boutons en bas. En portrait, deck et défausse passent dans la bande du bas.

type Selected = { card: InstanceId; anchor: DOMRect };
type Pending = { action: Action; message: string; confirm: string; toast: string };

function confirmationFor(catalog: Catalog, state: GameState, action: Action): { message: string; confirm: string } | null {
  let next: GameState;
  try {
    next = applyAction(catalog, state, action);
  } catch {
    return null;
  }
  const lost = totalResources(next.lostResources);
  const parts: string[] = [];
  if (action.type === "useEffect") {
    const effect = usableEffects(catalog, state, action.card).find((e) => e.effect.id === action.effect)?.effect;
    if (effect?.type === "destroy") parts.push(`${cardName(catalog, state, action.card)} sera détruite définitivement.`);
    if (effect?.oneTime) parts.push("Cet effet ne peut servir qu'une fois : il sera rayé.");
  }
  if (lost > 0) {
    const icons = Object.entries(next.lostResources).flatMap(([r, n]) => Array.from({ length: n }, () => `{${r}}`));
    parts.push(`Tu vas perdre ${lost} ressource${lost > 1 ? "s" : ""} non dépensée${lost > 1 ? "s" : ""} : ${icons.join("")}.`);
  }
  return parts.length ? { message: parts.join(" "), confirm: "Continuer" } : null;
}

function toastFor(action: Action): string {
  switch (action.type) {
    case "produce":
      return "Production faite";
    case "upgrade":
      return "Carte améliorée, fin du tour";
    case "useEffect":
      return "Effet appliqué";
    case "advance":
      return "2 cartes de plus en jeu";
    case "pass":
      return "Tour terminé";
    default:
      return "";
  }
}

export function GameScreen({ catalog, kingdomId }: { catalog: Catalog; kingdomId: string }) {
  const { status, kingdom, session, toast, load, perform, undo, dismissToast } = useGame();
  const [selected, setSelected] = useState<Selected | null>(null);
  const [inspect, setInspect] = useState<InstanceId | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(() => window.innerWidth >= 1440);
  const [pending, setPending] = useState<Pending | null>(null);
  const [endClosed, setEndClosed] = useState(false);
  const playRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void load(catalog, kingdomId);
  }, [catalog, kingdomId, load]);

  const state = session ? current(session) : null;
  const legal = useMemo(() => (state ? getLegalActions(catalog, state) : []), [catalog, state]);
  const [fitRef, cardWidth] = useFitCards(state?.zones.play.length ?? 0);

  const request = useCallback(
    (action: Action) => {
      if (!state) return;
      setSelected(null);
      const c = confirmationFor(catalog, state, action);
      const t = toastFor(action);
      if (c) setPending({ action, ...c, toast: t });
      else perform(action, t);
    },
    [catalog, state, perform],
  );

  // Clavier (spec 7.6) : A = Avancer, P = Passer, U ou Cmd+Z = Annuler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || pending || inspect || discardOpen || state?.pending) return;
      const key = e.key.toLowerCase();
      if ((key === "z" && (e.metaKey || e.ctrlKey)) || (key === "u" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        undo();
      } else if (key === "a" && !e.metaKey && !e.ctrlKey) {
        const a = legal.find((x) => x.type === "advance");
        if (a) request(a);
      } else if (key === "p" && !e.metaKey && !e.ctrlKey) {
        const a = legal.find((x) => x.type === "pass");
        if (a) request(a);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [legal, request, undo, pending, inspect, discardOpen, state?.pending]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismissToast, 4000);
    return () => window.clearTimeout(t);
  }, [toast, dismissToast]);

  if (status === "missing") {
    return (
      <div className={styles.center}>
        <p>Ce royaume n'existe pas (ou plus) sur cet appareil.</p>
        <a className="btn" href="#/">
          Retour aux royaumes
        </a>
      </div>
    );
  }
  if (!state || !kingdom || !session) return <div className={styles.center}>Chargement du royaume…</div>;

  const tpl = (id: InstanceId) => template(catalog, instance(state, id).templateId);
  const card = (id: InstanceId, width: number | undefined, onTap?: () => void, inspectable = true) => (
    <CardView
      key={id}
      id={id}
      template={tpl(id)}
      orientation={instance(state, id).orientation}
      label={cardName(catalog, state, id)}
      width={width}
      selected={selected?.card === id}
      onTap={onTap}
      onLongPress={inspectable ? () => setInspect(id) : undefined}
    />
  );
  const fame = computeScore(catalog, state).total;
  const top = state.zones.deck[0];
  const lastDiscard = state.zones.discard.at(-1);
  const advance = legal.find((a) => a.type === "advance");
  const pass = legal.find((a) => a.type === "pass");
  const playing = state.phase === "playing" && !state.pending;

  const deck = (
    <div className={styles.pile} aria-label={`Deck : ${state.zones.deck.length} cartes`}>
      <span className={styles.pileTitle}>Deck · {state.zones.deck.length}</span>
      {top ? card(top, undefined, undefined, false) : <div className={styles.emptyPile}>Vide</div>}
    </div>
  );
  const discard = (
    <div className={styles.pile} aria-label={`Défausse : ${state.zones.discard.length} cartes`}>
      <span className={styles.pileTitle}>Défausse · {state.zones.discard.length}</span>
      {lastDiscard ? (
        card(lastDiscard, undefined, () => setDiscardOpen(true))
      ) : (
        <button className={styles.emptyPile} onClick={() => setDiscardOpen(true)}>
          Vide
        </button>
      )}
    </div>
  );
  const resources = (
    <div className={styles.resources} aria-label="Ressources">
      {catalog.resources.map((r) => (
        <span key={r} className={`${styles.resource} ${(state.resources[r] ?? 0) === 0 ? styles.zero : ""}`}>
          <Icon id={r} /> {state.resources[r] ?? 0}
        </span>
      ))}
    </div>
  );
  const buttons = (
    <div className={styles.turnButtons}>
      <button className="btn" disabled={!playing || !advance} onClick={() => advance && request(advance)}>
        Avancer <kbd>A</kbd>
      </button>
      <button className="btn btn-primary" disabled={!playing || !pass} onClick={() => pass && request(pass)}>
        Passer <kbd>P</kbd>
      </button>
    </div>
  );

  return (
    <div className={`${styles.game} ${journalOpen ? styles.withJournal : ""}`}>
      <div className={styles.tooNarrow}>Agrandis la fenêtre pour jouer (744 px de large au minimum).</div>

      <header className={styles.topbar}>
        <a className="btn" href="#/" aria-label="Retour aux royaumes">
          ☰
        </a>
        <h1>
          {kingdom.emoji} {kingdom.name}
          <span>
            Manche {state.round}
            {state.finalRound ? " (dernière)" : ""} · {state.turn > 0 ? `Tour ${state.turn}` : "Début de manche"} · <IconText text={`{fame} ${fame}`} />
          </span>
        </h1>
        <button className="btn" disabled={!canUndo(session)} onClick={undo} title="Annuler (U)">
          ⟲ Annuler
        </button>
        <button className="btn" aria-pressed={journalOpen} onClick={() => setJournalOpen((o) => !o)}>
          Journal
        </button>
      </header>

      {state.zones.permanent.length > 0 && (
        <section className={styles.permanents} aria-label="Cartes permanentes">
          {state.zones.permanent.map((id) => card(id, 72, () => setInspect(id)))}
        </section>
      )}

      <aside className={styles.deckSlot}>{deck}</aside>

      <main
        className={styles.play}
        ref={(node) => {
          playRef.current = node;
          fitRef(node);
        }}
        aria-label="Zone de jeu"
      >
        {state.zones.play.map((id) =>
          card(id, cardWidth || undefined, () => {
            const el = playRef.current?.querySelector(`[data-card="${id}"]`);
            setSelected({ card: id, anchor: (el ?? playRef.current)?.getBoundingClientRect() ?? new DOMRect() });
          }),
        )}
        {state.zones.play.length === 0 && <p className={styles.muted}>Aucune carte en jeu.</p>}
      </main>

      <aside className={styles.discardSlot}>{discard}</aside>

      <footer className={styles.bottombar}>
        {resources}
        {buttons}
      </footer>

      {journalOpen && (
        <aside className={styles.journal} aria-label="Journal">
          <h2>Journal</h2>
          <ol reversed>
            {[...state.log].reverse().slice(0, 200).map((e, i) => (
              <li key={state.log.length - i}>
                <small>
                  M{e.round}·T{e.turn}
                </small>{" "}
                <IconText text={e.text} />
              </li>
            ))}
          </ol>
        </aside>
      )}

      {selected && playing && (
        <CardActions
          catalog={catalog}
          state={state}
          card={selected.card}
          anchor={selected.anchor}
          legal={legal}
          onAction={request}
          onInspect={() => {
            setInspect(selected.card);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {inspect && <Inspector catalog={catalog} state={state} card={inspect} onClose={() => setInspect(null)} />}
      {discardOpen && (
        <CardListDialog
          catalog={catalog}
          state={state}
          title="Défausse"
          cards={state.zones.discard}
          onInspect={setInspect}
          onClose={() => setDiscardOpen(false)}
        />
      )}
      {state.pending && <DecisionDialog catalog={catalog} state={state} onAction={(a) => perform(a)} />}
      {state.phase === "gameOver" && !endClosed && (
        <EndDialog catalog={catalog} state={state} onBack={() => (window.location.hash = "#/")} onClose={() => setEndClosed(true)} />
      )}
      {pending && (
        <ConfirmDialog
          message={pending.message}
          confirm={pending.confirm}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            perform(pending.action, pending.toast);
            setPending(null);
          }}
        />
      )}
      {toast && (
        <div className={styles.toast} role="status" key={toast.id}>
          <IconText text={toast.text} />
          {canUndo(session) && (
            <button className="btn" onClick={undo}>
              Annuler
            </button>
          )}
        </div>
      )}
    </div>
  );
}
