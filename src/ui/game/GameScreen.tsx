import { useCallback, useEffect, useMemo, useState } from "react";
import type { ResourceId } from "../../data/schema";
import {
  actionCost,
  activeStage,
  applyAction,
  candidateActions,
  canUndo,
  cardName,
  computeScore,
  current,
  describeAction,
  engagedPotential,
  getLegalActions,
  instance,
  planWithEngaged,
  productionGroups,
  template,
  totalResources,
  usableEffects,
  type Action,
  type Catalog,
  type GameState,
  type InstanceId,
} from "../../engine";
import { Icon, IconText } from "../common/IconText";
import type { TapPoint } from "../common/usePress";
import { CardActions, type CardOption } from "./CardActions";
import { zoneAt, type ZoneKind } from "./cardZones";
import { CardView } from "./CardView";
import { CardListDialog, ConfirmDialog, DecisionDialog, EndDialog, Inspector } from "./Dialogs";
import { useGame } from "./store";
import { useFitCards } from "./useFitCards";
import styles from "./Game.module.css";

// Plateau de jeu (spec 7.3) : deck à gauche (toucher = Avancer), zone de jeu au centre, défausse à droite,
// ressources et boutons en bas. Sur une carte en jeu : toucher la ressource l'engage, toucher la boîte
// d'amélioration améliore, toucher l'effet l'applique ; ailleurs, la feuille d'actions s'ouvre.

type Selected = { card: InstanceId; anchor: DOMRect };
type Pending = { plan: Action[]; message: string; toast: string };

const icons = (rs: readonly ResourceId[]) => rs.map((r) => `{${r}}`).join("");

function productionLabel(catalog: Catalog, s: GameState, id: InstanceId): string | null {
  const groups = productionGroups(catalog, s, id);
  if (groups.length === 0) return null;
  return groups.map((g) => g.options.map((o) => icons(o)).join("/")).join(" + ");
}

/** Ce qu'une action coûte encore, une fois comptées les ressources en cours et les cartes engagées. */
function missingText(catalog: Catalog, s: GameState, a: Action, engaged: InstanceId[]): string {
  const cost = actionCost(catalog, s, a);
  if (!cost) return "Conditions non remplies";
  const have: Record<string, number> = { ...s.resources };
  const pot = engagedPotential(catalog, s, engaged.filter((id) => !("card" in a) || id !== a.card));
  for (const [r, n] of Object.entries(pot.fixed)) have[r] = (have[r] ?? 0) + n;
  let flexible = pot.choices.length;
  const missing: ResourceId[] = [];
  for (const r of cost) {
    if ((have[r] ?? 0) > 0) have[r] = (have[r] ?? 0) - 1;
    else if (flexible > 0) flexible -= 1;
    else missing.push(r);
  }
  return missing.length ? `Il manque ${icons(missing)} : engage d'autres cartes` : "Pas payable avec les cartes engagées";
}

/** Confirmation nécessaire avant un geste (spec 7.5), ou null. */
function confirmationFor(catalog: Catalog, state: GameState, plan: Action[]): string | null {
  let s = state;
  const lost: Record<string, number> = {};
  const parts: string[] = [];
  for (const a of plan) {
    if (a.type === "useEffect") {
      const effect = usableEffects(catalog, s, a.card).find((e) => e.effect.id === a.effect)?.effect;
      if (effect?.type === "destroy") parts.push(`${cardName(catalog, s, a.card)} sera détruite définitivement.`);
      if (effect?.oneTime) parts.push("Cet effet ne sert qu'une fois : il sera rayé.");
    }
    if (a.type === "upgrade" && state.config.undoMode === "strict") {
      parts.push(`${describeAction(catalog, s, a)}. Impossible d'annuler ensuite (mode strict).`);
    }
    try {
      s = applyAction(catalog, s, a);
    } catch {
      return null;
    }
    for (const [r, n] of Object.entries(s.lostResources)) lost[r] = (lost[r] ?? 0) + n;
  }
  const n = totalResources(lost);
  if (n > 0) {
    const list = Object.entries(lost).flatMap(([r, k]) => Array.from({ length: k }, () => r));
    parts.push(`Tu vas perdre ${n} ressource${n > 1 ? "s" : ""} déjà produite${n > 1 ? "s" : ""} et non dépensée${n > 1 ? "s" : ""} : ${icons(list)}.`);
  }
  return parts.length ? parts.join(" ") : null;
}

function toastFor(action: Action | undefined, produced: number): string {
  const extra = produced > 0 ? ` (${produced} carte${produced > 1 ? "s" : ""} engagée${produced > 1 ? "s" : ""} utilisée${produced > 1 ? "s" : ""})` : "";
  switch (action?.type) {
    case "upgrade":
      return `Carte améliorée, fin du tour${extra}`;
    case "useEffect":
      return `Effet appliqué${extra}`;
    case "advance":
      return "2 cartes de plus en jeu";
    case "pass":
      return "Tour terminé";
    default:
      return "";
  }
}

export function GameScreen({ catalog, kingdomId }: { catalog: Catalog; kingdomId: string }) {
  const { status, kingdom, session, toast, engaged, load, perform, toggleEngaged, undo, dismissToast } = useGame();
  const [selected, setSelected] = useState<Selected | null>(null);
  const [inspect, setInspect] = useState<InstanceId | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(() => window.innerWidth >= 1440);
  const [pending, setPending] = useState<Pending | null>(null);
  const [endClosed, setEndClosed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void load(catalog, kingdomId);
  }, [catalog, kingdomId, load]);

  const state = session ? current(session) : null;
  const legal = useMemo(() => (state ? getLegalActions(catalog, state) : []), [catalog, state]);
  const engagedNow = useMemo(() => (state ? engaged.filter((id) => state.zones.play.includes(id)) : []), [engaged, state]);
  const [fitRef, cardWidth] = useFitCards(state?.zones.play.length ?? 0);
  const playing = state?.phase === "playing" && !state.pending;

  const optionsFor = useCallback(
    (card: InstanceId): CardOption[] => {
      if (!state) return [];
      return candidateActions(catalog, state, card).map((action) => {
        const plan = planWithEngaged(catalog, state, action, engagedNow);
        return { action, plan, label: describeAction(catalog, state, action), reason: plan ? null : missingText(catalog, state, action, engagedNow) };
      });
    },
    [catalog, state, engagedNow],
  );

  const run = useCallback(
    (plan: Action[]) => {
      if (!state) return;
      setSelected(null);
      const last = plan.at(-1);
      const t = toastFor(last, plan.length - 1);
      const message = confirmationFor(catalog, state, plan);
      if (message) setPending({ plan, message, toast: t });
      else perform(plan, t);
    },
    [catalog, state, perform],
  );

  const flash = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((n) => (n === text ? null : n)), 3500);
  }, []);

  const advance = legal.find((a) => a.type === "advance");
  const pass = legal.find((a) => a.type === "pass");

  // Clavier (spec 7.6) : A = Avancer, P = Passer, U ou Cmd+Z = Annuler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || pending || inspect || discardOpen || state?.pending) return;
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if ((key === "z" && mod) || (key === "u" && !mod)) {
        e.preventDefault();
        undo();
      } else if (key === "a" && !mod && advance) run([advance]);
      else if (key === "p" && !mod && pass) run([pass]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, pass, run, undo, pending, inspect, discardOpen, state?.pending]);

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

  /** Options d'une zone : améliorations selon la flèche, effets du stage actif. */
  const zoneOptions = (card: InstanceId, zone: ZoneKind): CardOption[] => {
    const stage = activeStage(catalog, state, card);
    if (!stage) return [];
    const all = optionsFor(card);
    if (zone === "upgradeFlip" || zone === "upgradeRotate") {
      const arrow = zone === "upgradeFlip" ? "flip" : "rotate";
      const ups = stage.upgrades.length === 1 ? stage.upgrades : stage.upgrades.filter((u) => u.arrow === arrow);
      return all.filter((o) => o.action.type === "upgrade" && ups.some((u) => u.id === (o.action.type === "upgrade" ? o.action.upgrade : "")));
    }
    if (zone === "effect") return all.filter((o) => o.action.type === "useEffect");
    return [];
  };

  const zoneLabel = (card: InstanceId) => (zone: ZoneKind): string | null => {
    if (!playing) return null;
    if (zone === "production") {
      const p = productionLabel(catalog, state, card);
      if (!p) return null;
      return engagedNow.includes(card) ? `Libérer (ne plus utiliser ${p})` : `Engager pour ${p}`;
    }
    const opts = zoneOptions(card, zone);
    const first = opts[0];
    if (!first) return null;
    if (opts.length > 1) return `${opts.length} choix possibles : toucher pour choisir`;
    return first.plan ? first.label : `${first.label} (${first.reason ?? "impossible"})`;
  };

  const openMenu = (card: InstanceId) => {
    const el = document.querySelector(`main [data-card="${card}"]`);
    setSelected({ card, anchor: el?.getBoundingClientRect() ?? new DOMRect() });
  };

  const tapCard = (card: InstanceId, p: TapPoint) => {
    if (!playing) return;
    const zone = zoneAt(p.x, p.y);
    if (zone === "production" && productionLabel(catalog, state, card)) {
      toggleEngaged(card);
      return;
    }
    if (zone === "upgradeFlip" || zone === "upgradeRotate" || zone === "effect") {
      const opts = zoneOptions(card, zone);
      const only = opts[0];
      if (opts.length === 1 && only) {
        if (only.plan) run(only.plan);
        else flash(`${only.label} : ${only.reason ?? "impossible"}`);
        return;
      }
      if (opts.length === 0 && zone === "effect" && (activeStage(catalog, state, card)?.effects.length ?? 0) === 0) {
        openMenu(card);
        return;
      }
    }
    openMenu(card);
  };

  const card = (id: InstanceId, width: number | undefined, onTap?: (p: TapPoint) => void, inspectable = true, extra?: { engaged?: boolean; zones?: boolean }) => (
    <CardView
      key={id}
      id={id}
      template={tpl(id)}
      orientation={instance(state, id).orientation}
      label={cardName(catalog, state, id)}
      width={width}
      selected={selected?.card === id}
      engaged={extra?.engaged}
      badge={extra?.engaged ? <IconText text={`engagée ${productionLabel(catalog, state, id) ?? ""}`} /> : undefined}
      onTap={onTap}
      onLongPress={inspectable ? () => setInspect(id) : undefined}
      zoneLabel={extra?.zones ? zoneLabel(id) : undefined}
    />
  );

  const fame = computeScore(catalog, state).total;
  const top = state.zones.deck[0];
  const lastDiscard = state.zones.discard.at(-1);
  const potential = engagedPotential(catalog, state, engagedNow);

  const deck = (
    <div className={styles.pile} aria-label={`Deck : ${state.zones.deck.length} cartes`}>
      <span className={styles.pileTitle}>Deck · {state.zones.deck.length}</span>
      {top ? (
        <div title={advance ? "Toucher pour avancer (jouer 2 cartes de plus)" : undefined}>
          {card(top, undefined, playing && advance ? () => run([advance]) : undefined, false)}
        </div>
      ) : (
        <div className={styles.emptyPile}>Vide</div>
      )}
      {top && playing && advance && <span className={styles.pileHint}>Toucher = Avancer</span>}
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
      {catalog.resources.map((r) => {
        const have = state.resources[r] ?? 0;
        const more = potential.fixed[r] ?? 0;
        return (
          <span key={r} className={`${styles.resource} ${have + more === 0 ? styles.zero : ""}`}>
            <Icon id={r} /> {have}
            {more > 0 && <span className={styles.engagedCount}>+{more}</span>}
          </span>
        );
      })}
      {potential.choices.map((opts, i) => (
        <span key={`c${i}`} className={styles.resource}>
          <span className={styles.engagedCount}>
            +<IconText text={opts.map((o) => icons(o)).join("/")} />
          </span>
        </span>
      ))}
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
            {state.finalRound ? " (dernière)" : ""} · {state.turn > 0 ? `Tour ${state.turn}` : "Début de manche"} ·{" "}
            <IconText text={`{fame} ${fame}`} />
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

      <main className={styles.play} ref={fitRef} aria-label="Zone de jeu">
        {state.zones.play.map((id) =>
          card(id, cardWidth || undefined, (p) => tapCard(id, p), true, { engaged: engagedNow.includes(id), zones: true }),
        )}
        {state.zones.play.length === 0 && <p className={styles.muted}>Aucune carte en jeu.</p>}
      </main>

      <aside className={styles.discardSlot}>{discard}</aside>

      <footer className={styles.bottombar}>
        {resources}
        <div className={styles.turnButtons}>
          <button className="btn" disabled={!playing || !advance} onClick={() => advance && run([advance])}>
            Avancer <kbd>A</kbd>
          </button>
          <button className="btn btn-primary" disabled={!playing || !pass} onClick={() => pass && run([pass])}>
            Passer <kbd>P</kbd>
          </button>
        </div>
      </footer>

      {journalOpen && (
        <aside className={styles.journal} aria-label="Journal">
          <h2>Journal</h2>
          <ol reversed>
            {[...state.log]
              .reverse()
              .slice(0, 200)
              .map((e, i) => (
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
          options={optionsFor(selected.card)}
          engageLabel={productionLabel(catalog, state, selected.card)}
          engaged={engagedNow.includes(selected.card)}
          onEngage={() => {
            toggleEngaged(selected.card);
            setSelected(null);
          }}
          onRun={(o) => o.plan && run(o.plan)}
          onInspect={() => {
            setInspect(selected.card);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {inspect && <Inspector catalog={catalog} state={state} card={inspect} onClose={() => setInspect(null)} />}
      {discardOpen && (
        <CardListDialog catalog={catalog} state={state} title="Défausse" cards={state.zones.discard} onInspect={setInspect} onClose={() => setDiscardOpen(false)} />
      )}
      {state.pending && <DecisionDialog catalog={catalog} state={state} onAction={(a) => perform([a])} />}
      {state.phase === "gameOver" && !endClosed && (
        <EndDialog catalog={catalog} state={state} onBack={() => (window.location.hash = "#/")} onClose={() => setEndClosed(true)} />
      )}
      {pending && (
        <ConfirmDialog
          message={pending.message}
          confirm="Continuer"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            perform(pending.plan, pending.toast);
            setPending(null);
          }}
        />
      )}
      {(toast || notice) && (
        <div className={styles.toast} role="status" key={toast?.id ?? notice}>
          <IconText text={notice ?? toast?.text ?? ""} />
          {!notice && canUndo(session) && (
            <button className="btn" onClick={undo}>
              Annuler
            </button>
          )}
        </div>
      )}
    </div>
  );
}
