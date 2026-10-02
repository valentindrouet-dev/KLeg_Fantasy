import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { Orientation } from "../../data/schema";
import { APP_VERSION } from "../../version";
import { Icon, IconText } from "../common/IconText";
import { AdvanceIcon, CastleIcon, PassIcon, TranslateIcon, UndoIcon } from "../common/UiIcons";
import type { TapPoint } from "../common/usePress";
import { CardActions, type CardOption } from "./CardActions";
import { zoneAt, type ZoneKind } from "./cardZones";
import { ANIM_MS, CardView } from "./CardView";
import { CardListDialog, ConfirmDialog, DecisionDialog, EndDialog, Inspector } from "./Dialogs";
import { useGame } from "./store";
import { useFitCards } from "./useFitCards";
import { useCardMotion } from "./useCardMotion";
import { usePrefs } from "../common/prefs";
import styles from "./Game.module.css";

// Plateau de jeu (spec 7.3) : deck à gauche (toucher = Avancer), zone de jeu au centre, défausse à droite,
// ressources et boutons en bas. Sur une carte en jeu : toucher la ressource l'engage, toucher la boîte
// d'amélioration améliore, toucher l'effet l'applique ; ailleurs, la feuille d'actions s'ouvre.

type Selected = { card: InstanceId; anchor: DOMRect };
type Anim = { card: InstanceId; kind: "rotate" | "flip"; to: Orientation };
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
  return missing.length ? `Il manque ${icons(missing)}` : "Pas payable avec les cartes engagées";
}

/** Changement d'orientation que produit un geste sur sa carte (pour l'animer), ou null. */
function orientationChange(catalog: Catalog, state: GameState, plan: Action[]): Anim | null {
  const last = plan.at(-1);
  if (!last || !("card" in last) || last.type === "produce") return null;
  let s = state;
  try {
    for (const a of plan) s = applyAction(catalog, s, a);
  } catch {
    return null;
  }
  const before = instance(state, last.card).orientation;
  const after = instance(s, last.card).orientation;
  if (before.side !== after.side) return { card: last.card, kind: "flip", to: after };
  if (before.rotation !== after.rotation) return { card: last.card, kind: "rotate", to: after };
  return null;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Confirmation nécessaire avant un geste (spec 7.5), ou null. */
function confirmationFor(catalog: Catalog, state: GameState, plan: Action[]): string | null {
  if (plan.at(-1)?.type === "upgrade") return null; // demande du 2026-10-02 : améliorer sans confirmation
  let s = state;
  const lost: Record<string, number> = {};
  const parts: string[] = [];
  for (const a of plan) {
    if (a.type === "useEffect") {
      const effect = usableEffects(catalog, s, a.card).find((e) => e.effect.id === a.effect)?.effect;
      if (effect?.type === "destroy") parts.push(`${cardName(catalog, s, a.card)} sera détruite définitivement.`);
      if (effect?.oneTime) parts.push("Cet effet ne sert qu'une fois : il sera rayé.");
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

function toastFor(action: Action | undefined): string {
  const extra = "";
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
  const { status, kingdom, session, toast, engaged, load, perform, toggleEngaged, restart, undo, dismissToast } = useGame();
  const [selected, setSelected] = useState<Selected | null>(null);
  const [inspect, setInspect] = useState<InstanceId | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [roundBanner, setRoundBanner] = useState<{ key: number; text: string } | null>(null);
  const lastRound = useRef<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [endClosed, setEndClosed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [targeting, setTargeting] = useState<{ source: InstanceId; options: CardOption[] } | null>(null);
  const tooltipsFr = usePrefs((p) => p.tooltipsFr);
  const toggleTooltipsFr = usePrefs((p) => p.toggleTooltipsFr);
  const playEl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void load(catalog, kingdomId);
  }, [catalog, kingdomId, load]);

  // Tant que le royaume demandé n'est pas chargé, on n'affiche pas l'état d'un autre royaume.
  const state = session && kingdom?.id === kingdomId ? current(session) : null;
  const legal = useMemo(() => (state ? getLegalActions(catalog, state) : []), [catalog, state]);
  const engagedNow = useMemo(() => (state ? engaged.filter((id) => state.zones.play.includes(id)) : []), [engaged, state]);
  const [fitRef, cardWidth] = useFitCards(state?.zones.play.length ?? 0);
  useCardMotion(catalog, state, playEl);
  const playing = state?.phase === "playing" && !state.pending && !anim;

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

  /** Joue un geste ; si la carte change d'orientation, l'anime d'abord (rotation ou retournement). */
  const commit = useCallback(
    (plan: Action[], toast: string) => {
      if (!state) return;
      const a = reducedMotion() ? null : orientationChange(catalog, state, plan);
      if (!a) {
        perform(plan, toast);
        return;
      }
      setAnim(a);
      window.setTimeout(() => {
        perform(plan, toast);
        setAnim(null);
      }, ANIM_MS + 80);
    },
    [catalog, state, perform],
  );

  const run = useCallback(
    (plan: Action[]) => {
      if (!state) return;
      setSelected(null);
      const last = plan.at(-1);
      const t = toastFor(last);
      const message = confirmationFor(catalog, state, plan);
      if (message) setPending({ plan, message, toast: t });
      else commit(plan, t);
    },
    [catalog, state, commit],
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
      if (e.key === "Escape" && targeting) {
        setTargeting(null);
        return;
      }
      if (e.target instanceof HTMLInputElement || pending || inspect || discardOpen || state?.pending || anim || targeting) return;
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
  }, [advance, pass, run, undo, pending, inspect, discardOpen, state?.pending, anim, targeting]);

  // Nouvelle manche : message central qui apparaît puis disparaît.
  const round = state?.round ?? null;
  const finalRound = state?.finalRound ?? false;
  useEffect(() => {
    if (round === null) return;
    const before = lastRound.current;
    lastRound.current = round;
    if (before === null || round <= before) return;
    setRoundBanner({ key: round, text: finalRound ? `Manche ${round} · dernière manche` : `Manche ${round}` });
    const t = window.setTimeout(() => setRoundBanner(null), 2200);
    return () => window.clearTimeout(t);
  }, [round, finalRound]);

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
      return engagedNow.includes(card) ? `Libérer ${p}` : `Engager ${p}`;
    }
    const opts = zoneOptions(card, zone);
    const first = opts[0];
    if (!first) return null;
    if (opts.length > 1) return first.label.replace(/ \[.*$/, "").replace(/, en défaussant .*$/, "");
    return first.plan ? first.label : `${first.label} (${first.reason ?? "impossible"})`;
  };

  const openMenu = (card: InstanceId) => {
    const el = document.querySelector(`main [data-card="${card}"]`);
    setSelected({ card, anchor: el?.getBoundingClientRect() ?? new DOMRect() });
  };

  /** Cibles possibles de l'effet en cours de ciblage, par carte visée. */
  const targetOptions = new Map<InstanceId, CardOption>(
    (targeting?.options ?? []).flatMap((o) => (o.action.type === "useEffect" && o.action.targets[0] ? [[o.action.targets[0], o] as const] : [])),
  );
  const targetsInDiscard = [...targetOptions.keys()].filter((id) => state.zones.discard.includes(id));

  const tapCard = (card: InstanceId, p: TapPoint) => {
    if (targeting) {
      const o = targetOptions.get(card);
      setTargeting(null);
      if (o?.plan) run(o.plan);
      return;
    }
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
      // Effet à cible unique (ex. « Discard a friendly card ») : toucher l'effet, puis la carte visée.
      const targeted = opts.filter((o) => o.action.type === "useEffect" && o.action.targets.length === 1);
      if (zone === "effect" && opts.length > 1 && targeted.length === opts.length) {
        const playable = targeted.filter((o) => o.plan);
        if (playable.length === 0) {
          flash(`${targeted[0]?.label.replace(/ \[.*$/, "") ?? ""} : ${targeted[0]?.reason ?? "impossible"}`);
          return;
        }
        setTargeting({ source: card, options: playable });
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
      targetable={targeting ? targetOptions.has(id) : undefined}
      dimmed={targeting ? !targetOptions.has(id) && id !== targeting.source : undefined}
      badge={extra?.engaged ? <IconText text={`engagée ${productionLabel(catalog, state, id) ?? ""}`} /> : undefined}
      onTap={onTap}
      onLongPress={inspectable ? () => setInspect(id) : undefined}
      zoneLabel={extra?.zones ? zoneLabel(id) : undefined}
      anim={anim?.card === id ? { kind: anim.kind, to: anim.to } : undefined}
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
        <div data-pile="deck">{card(top, undefined, playing && advance ? () => run([advance]) : undefined, false)}</div>
      ) : (
        <div className={styles.emptyPile}>Vide</div>
      )}
    </div>
  );
  const discard = (
    <div className={styles.pile} aria-label={`Défausse : ${state.zones.discard.length} cartes`}>
      <span className={styles.pileTitle}>Défausse · {state.zones.discard.length}</span>
      {lastDiscard ? (
        <div data-pile="discard">{card(lastDiscard, undefined, () => setDiscardOpen(true))}</div>
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
        if (have + more === 0) return null;
        return (
          <span key={r} className={styles.resource}>
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
    <div className={styles.game}>
      <div className={styles.tooNarrow}>Agrandis la fenêtre pour jouer (744 px de large au minimum).</div>

      <header className={styles.topbar}>
        <a className={styles.iconBtn} href="#/" aria-label="Mes royaumes" title="Mes royaumes">
          <CastleIcon />
        </a>
        <h1>
          {kingdom.emoji} {kingdom.name}
          <span>
            Manche {state.round}
            {state.finalRound ? " (dernière)" : ""} · {state.turn > 0 ? `Tour ${state.turn}` : "Début de manche"} ·{" "}
            <IconText text={`{fame} ${fame}`} />
          </span>
          <small className={styles.version}>{APP_VERSION}</small>
        </h1>
        <button className={styles.iconBtn} disabled={!canUndo(session)} onClick={undo} aria-label="Annuler" title="Annuler (U)">
          <UndoIcon />
        </button>
        <button
          className={`${styles.iconBtn} ${styles.aboveDialogs}`}
          aria-pressed={tooltipsFr}
          onClick={toggleTooltipsFr}
          aria-label="Infobulles en français"
          title="Infobulles en français"
        >
          <TranslateIcon />
        </button>
      </header>

      {state.zones.permanent.length > 0 && (
        <section className={styles.permanents} aria-label="Cartes permanentes">
          {state.zones.permanent.map((id) => card(id, 72, () => setInspect(id)))}
        </section>
      )}

      <aside className={styles.deckSlot}>{deck}</aside>

      <div className={styles.resourceRow}>{resources}</div>

      <main
        className={styles.play}
        ref={(node) => {
          playEl.current = node;
          fitRef(node);
        }}
        aria-label="Zone de jeu"
      >
        {state.zones.play.map((id) =>
          card(id, cardWidth || undefined, (p) => tapCard(id, p), true, { engaged: engagedNow.includes(id), zones: true }),
        )}
      </main>

      <aside className={styles.discardSlot}>{discard}</aside>

      <div className={styles.turnButtons}>
        <button className={styles.turnBtn} disabled={!playing || !advance} onClick={() => advance && run([advance])} title="Avancer (A)">
          <AdvanceIcon /> Avancer
        </button>
        <button className={`${styles.turnBtn} ${styles.turnBtnPrimary}`} disabled={!playing || !pass} onClick={() => pass && run([pass])} title="Passer (P)">
          Passer <PassIcon />
        </button>
      </div>

      {roundBanner && (
        <div className={styles.roundBanner} key={roundBanner.key} role="status">
          {roundBanner.text}
        </div>
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
      {targeting && targetsInDiscard.length > 0 && (
        <CardListDialog
          catalog={catalog}
          state={state}
          title="Défausse"
          cards={targetsInDiscard}
          onInspect={(id) => {
            const o = targetOptions.get(id);
            setTargeting(null);
            if (o?.plan) run(o.plan);
          }}
          onClose={() => setTargeting(null)}
        />
      )}
      {discardOpen && (
        <CardListDialog catalog={catalog} state={state} title="Défausse" cards={state.zones.discard} onInspect={setInspect} onClose={() => setDiscardOpen(false)} />
      )}
      {state.pending && <DecisionDialog catalog={catalog} state={state} onAction={(a) => perform([a])} onRestart={restart} />}
      {state.phase === "gameOver" && !endClosed && (
        <EndDialog catalog={catalog} state={state} onBack={() => (window.location.hash = "#/")} onClose={() => setEndClosed(true)} />
      )}
      {pending && (
        <ConfirmDialog
          message={pending.message}
          confirm="Continuer"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            commit(pending.plan, pending.toast);
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
