import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResourceId } from "../../data/schema";
import {
  actionCost,
  activeStage,
  applyAction,
  candidateActions,
  isFullImage,
  paymentCandidates,
  canPeekSecond,
  cardBadges,
  showsTopHalfOnly,
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
  type Action,
  type Catalog,
  type GameState,
  type InstanceId,
} from "../../engine";
import type { Orientation } from "../../data/schema";
import { APP_VERSION } from "../../version";
import { IconText } from "../common/IconText";
import { AdvanceIcon, CastleIcon, PassIcon, SaveIcon, SettingsIcon, SortIcon, StatsIcon, TranslateIcon, UndoIcon } from "../common/UiIcons";
import { downloadText } from "../common/download";
import { feedbackUrl } from "../common/feedback";
import { backupFileName, exportKingdom } from "../../persistence/backup";
import { playLayout } from "./sortCards";
import { BLOCKED_PEEK, CARD_ASPECT, type Slot } from "./fitCards";

/** Écart entre les ennemis et les cartes « stays in play » de la ligne du haut (px, écart des cartes compris). */
const TOP_SPACER = 40;
import type { TapPoint } from "../common/usePress";
import { CardActions, type CardOption } from "./CardActions";
import { zoneAtCard, type ZoneKind } from "./cardZones";
import { ANIM_MS, CardView } from "./CardView";
import { CardListDialog, ConfirmDialog, DecisionDialog, EndDialog, Inspector, StatsDialog, TranslationBubble } from "./Dialogs";
import { useGame } from "./store";
import { cardWidthFor, useFitArea } from "./useFitCards";
import { useCardMotion } from "./useCardMotion";
import { usePrefs, ZOOM_MAX, ZOOM_MIN } from "../common/prefs";
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
  if (!missing.length) return "Pas payable avec les cartes engagées";
  // La carte de l'action ne peut pas payer avec sa propre production (produire la défausse).
  const own = "card" in a && productionGroups(catalog, s, a.card).some((g) => g.options.some((o) => o.some((r) => missing.includes(r))));
  return `Il manque ${icons(missing)}${own ? " (la carte ne peut pas payer avec sa propre production)" : ""}`;
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


/** Pas de message après une action (demandes du 2026-10-02) : l'annulation reste dans la barre du haut. */
function toastFor(_action: Action | undefined): string {
  return "";
}

export function GameScreen({ catalog, kingdomId }: { catalog: Catalog; kingdomId: string }) {
  const { status, kingdom, session, toast, engaged, flagged, load, perform, toggleEngaged, toggleFlag, restart, undo, dismissToast } = useGame();
  const [selected, setSelected] = useState<Selected | null>(null);
  const [inspect, setInspect] = useState<InstanceId | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [roundBanner, setRoundBanner] = useState<{ key: number; text: string } | null>(null);
  const [bubble, setBubble] = useState<{ card: InstanceId; half: "top" | "bottom"; x: number; y: number } | null>(null);
  const lastRound = useRef<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [endClosed, setEndClosed] = useState(false);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [targeting, setTargeting] = useState<{ source: InstanceId; options: CardOption[] } | null>(null);
  /** Effet ou amélioration touché sans assez de ressources : on touche ensuite les cartes qui paient. */
  const [paying, setPaying] = useState<{ source: InstanceId; action: Action } | null>(null);
  const { tooltipsFr, toggleTooltipsFr, zoom, setZoom, dimBottom, toggleDimBottom, sortPlay: sortMode, setSortPlay, theme, setTheme } = usePrefs();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [destroyedOpen, setDestroyedOpen] = useState(false);
  const playEl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void load(catalog, kingdomId);
  }, [catalog, kingdomId, load]);

  // Tant que le royaume demandé n'est pas chargé, on n'affiche pas l'état d'un autre royaume.
  const state = session && kingdom?.id === kingdomId ? current(session) : null;
  const legal = useMemo(() => (state ? getLegalActions(catalog, state) : []), [catalog, state]);
  const engagedNow = useMemo(() => (state ? engaged.filter((id) => state.zones.play.includes(id)) : []), [engaged, state]);
  // Ligne du haut : ennemis, puis (un peu à l'écart) les cartes « stays in play » ; seules sur leur ligne si les cartes
  // gardent au moins 75 % de leur taille, sinon simplement en tête. Une carte qui en bloque d'autres est plus haute.
  const layout = useMemo(
    () => (state ? playLayout(catalog, state, state.zones.play, sortMode) : { enemies: [], stays: [], others: [] }),
    [catalog, state, sortMode],
  );
  const ordered = useMemo(() => [...layout.enemies, ...layout.stays, ...layout.others], [layout]);
  const topCount = layout.enemies.length + layout.stays.length;
  const spacerAt = layout.enemies.length > 0 && layout.stays.length > 0 ? layout.enemies.length : -1;
  const [fitRef, area] = useFitArea();
  const { cardWidth, enemyRow } = useMemo(() => {
    const slots = (withBreak: boolean): Slot[] =>
      ordered.map((id, i) => ({
        h: (state && showsTopHalfOnly(catalog, state, id) ? 0.5 : 1) + BLOCKED_PEEK * (state?.blocks?.[id]?.length ?? 0),
        breakBefore: withBreak && i === topCount,
        space: i === spacerAt ? TOP_SPACER : 0,
      }));
    const flat = cardWidthFor(area, slots(false), zoom);
    if (topCount === 0 || topCount === ordered.length) return { cardWidth: flat, enemyRow: false };
    const split = cardWidthFor(area, slots(true), zoom);
    return split >= 0.75 * flat ? { cardWidth: split, enemyRow: true } : { cardWidth: flat, enemyRow: false };
  }, [ordered, topCount, spacerAt, state, area, zoom]);
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
      // Aucune confirmation (demandes du 2026-10-02) : le geste part tout de suite, « Annuler » reste possible.
      commit(plan, t);
    },
    [catalog, state, commit],
  );


  const advance = legal.find((a) => a.type === "advance");
  const pass = legal.find((a) => a.type === "pass");

  // Clavier (spec 7.6) : A = Avancer, P = Passer, U ou Cmd+Z = Annuler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && paying) {
        setPaying(null);
        return;
      }
      if (e.key === "Escape" && targeting) {
        setTargeting(null);
        return;
      }
      if (e.target instanceof HTMLInputElement || pending || inspect || discardOpen || state?.pending || anim || targeting || paying) return;
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
  }, [advance, pass, run, undo, pending, inspect, discardOpen, state?.pending, anim, targeting, paying]);

  // Bulle de traduction : se ferme au toucher suivant ou après quelques secondes.
  useEffect(() => {
    if (!bubble) return;
    const close = () => setBubble(null);
    const t = window.setTimeout(close, 6000);
    window.addEventListener("pointerdown", close, { capture: true, once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", close, { capture: true });
    };
  }, [bubble]);

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
    const el = document.querySelector(`[data-card="${card}"]`);
    setSelected({ card, anchor: el?.getBoundingClientRect() ?? new DOMRect() });
  };

  /** Cibles possibles de l'effet en cours de ciblage, par carte visée. */
  const targetOptions = new Map<InstanceId, CardOption>(
    (targeting?.options ?? []).flatMap((o) => (o.action.type === "useEffect" && o.action.targets[0] ? [[o.action.targets[0], o] as const] : [])),
  );
  const targetsInDiscard = [...targetOptions.keys()].filter((id) => state.zones.discard.includes(id));

  const showTranslation = (card: InstanceId, p: TapPoint) => {
    if (!tooltipsFr) return;
    const r = playEl.current?.querySelector(`[data-card="${card}"]`)?.getBoundingClientRect();
    if (!r) return;
    setBubble({ card, half: p.y < 0.5 ? "top" : "bottom", x: r.left + p.x * r.width, y: r.top + p.y * r.height });
  };

  /** Cartes qui peuvent payer l'action en attente de paiement. */
  const payers = new Set(paying ? paymentCandidates(catalog, state, paying.action, engagedNow) : []);

  /** Option impayable : si des cartes en jeu peuvent fournir ce qui manque, on passe au choix des cartes qui paient. */
  const startPaying = (source: InstanceId, o: CardOption): boolean => {
    if (o.plan || !(o.reason ?? "").startsWith("Il manque")) return false;
    // Seulement si les cartes en jeu peuvent couvrir tout le coût ; sinon le menu dit ce qui manque.
    const all = paymentCandidates(catalog, state, o.action, engagedNow);
    if (all.length === 0 || !planWithEngaged(catalog, state, o.action, [...engagedNow, ...all])) return false;
    setSelected(null);
    setPaying({ source, action: o.action });
    return true;
  };

  const tapCard = (card: InstanceId, p: TapPoint) => {
    if (paying) {
      if (!payers.has(card)) {
        setPaying(null);
        return;
      }
      // La carte touchée est engagée ; dès que les cartes engagées couvrent le coût, l'action part.
      const nextEngaged = [...engagedNow, card];
      toggleEngaged(card);
      const plan = planWithEngaged(catalog, state, paying.action, nextEngaged);
      if (plan) {
        setPaying(null);
        run(plan);
      }
      return;
    }
    if (targeting) {
      const o = targetOptions.get(card);
      setTargeting(null);
      if (o?.plan) run(o.plan);
      return;
    }
    if (!playing) return;
    const zone = zoneAtCard(p.x, p.y, isFullImage(tpl(card)));
    if (zone === "production" && productionLabel(catalog, state, card)) {
      toggleEngaged(card);
      return;
    }
    if (zone === "upgradeFlip" || zone === "upgradeRotate" || zone === "effect") {
      const opts = zoneOptions(card, zone);
      const only = opts[0];
      if (opts.length === 1 && only) {
        if (only.plan) run(only.plan);
        else if (!startPaying(card, only)) openMenu(card); // le menu dit ce qui manque
        return;
      }
      // Effet à cible unique (ex. « Discard a friendly card ») : toucher l'effet, puis la carte visée.
      const targeted = opts.filter((o) => o.action.type === "useEffect" && o.action.targets.length === 1);
      if (zone === "effect" && opts.length > 1 && targeted.length === opts.length) {
        const playable = targeted.filter((o) => o.plan);
        if (playable.length === 0) return;
        setTargeting({ source: card, options: playable });
        return;
      }
      // Plusieurs choix sans cible (ex. Bazaar : bois ou pierre) : petit menu de choix.
      if (opts.length > 1) openMenu(card);
    }
    // Zone neutre : bulle de traduction de la moitié touchée, si les infobulles FR sont activées.
    showTranslation(card, p);
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
      flagged={extra?.zones ? flagged.includes(id) : undefined}
      onTwoFinger={extra?.zones ? () => toggleFlag(id) : undefined}
      dimBottom={dimBottom && extra?.zones !== false}
      targetable={targeting ? targetOptions.has(id) : paying ? payers.has(id) : undefined}
      dimmed={targeting ? !targetOptions.has(id) && id !== targeting.source : paying ? !payers.has(id) && id !== paying.source : undefined}
      badge={badgeFor(id, extra?.engaged ?? false)}
      onTap={onTap}
      onLongPress={inspectable ? () => setInspect(id) : undefined}
      zoneLabel={extra?.zones ? zoneLabel(id) : undefined}
      anim={anim?.card === id ? { kind: anim.kind, to: anim.to } : undefined}
      stickers={instance(state, id).stickers}
      half={extra?.zones ? showsTopHalfOnly(catalog, state, id) : undefined}
    />
  );

  /** Pastille : ressource engagée, cartes bloquées, cases cochées, compteur, stickers du stage visible. */
  const badgeFor = (id: InstanceId, isEngaged: boolean) => {
    const parts = cardBadges(catalog, state, id);
    if (isEngaged) parts.unshift(`engagée ${productionLabel(catalog, state, id) ?? ""}`);
    return parts.length ? <IconText text={parts.join(" · ")} /> : undefined;
  };

  /**
   * Carte permanente touchée : son effet (Army, Treasury…). Payable : il part ; il manque des ressources : les cartes
   * qui peuvent payer s'allument ; plusieurs effets : le menu. Sans effet : l'inspection (appui long aussi).
   */
  const tapPermanent = (id: InstanceId) => {
    const opts = playing ? optionsFor(id) : [];
    const only = opts[0];
    if (opts.length === 1 && only) {
      if (only.plan) run(only.plan);
      else if (!startPaying(id, only)) openMenu(id); // le menu dit ce qui manque
      return;
    }
    if (opts.length > 1) openMenu(id);
    else setInspect(id);
  };

  const fame = computeScore(catalog, state).total;
  const top = state.zones.deck[0];
  const second = canPeekSecond(catalog, state) ? state.zones.deck[1] : undefined;
  const lastDiscard = state.zones.discard.at(-1);
  const potential = engagedPotential(catalog, state, engagedNow);

  const deck = (
    <div className={styles.pile} aria-label={`Deck : ${state.zones.deck.length} cartes`}>
      <span className={styles.pileTitle}>Deck · {state.zones.deck.length}</span>
      {top ? (
        <div data-pile="deck">{card(top, undefined, playing && advance ? () => run([advance]) : undefined, false)}</div>
      ) : (
        <div className={styles.emptyPile} data-pile="deck">
          Vide
        </div>
      )}
    </div>
  );
  const discard = (
    <div className={styles.pile} aria-label={`Défausse : ${state.zones.discard.length} cartes`}>
      <span className={styles.pileTitle}>Défausse · {state.zones.discard.length}</span>
      {lastDiscard ? (
        <div data-pile="discard">{card(lastDiscard, undefined, () => setDiscardOpen(true))}</div>
      ) : (
        <button className={styles.emptyPile} data-pile="discard" onClick={() => setDiscardOpen(true)}>
          Vide
        </button>
      )}
    </div>
  );
  // Ressources : icône + total (en cours + cartes engagées), seulement celles qu'on a.
  // Un seul compteur (demande du 2026-10-02) : par ressource, ce qu'on a (gagné ou engagé) plus ce que les autres
  // cartes en jeu peuvent produire ; l'icône est entourée de vert quand une partie est déjà gagnée.
  const available = engagedPotential(
    catalog,
    state,
    state.zones.play.filter((id) => !engagedNow.includes(id)),
  );
  const counters = [
    ...catalog.resources.flatMap((r) => {
      const banked = (state.resources[r] ?? 0) + (potential.fixed[r] ?? 0);
      const total = banked + (available.fixed[r] ?? 0);
      return total ? [{ key: r, text: `{${r}}`, n: total, banked: banked > 0 }] : [];
    }),
    ...potential.choices.map((opts, i) => ({ key: `e${i}`, text: opts.map((o) => icons(o)).join("/"), n: 1, banked: true })),
    ...available.choices.map((opts, i) => ({ key: `c${i}`, text: opts.map((o) => icons(o)).join("/"), n: 1, banked: false })),
  ];
  const resources = (
    <div className={styles.resources} aria-label="Ressources">
      {counters.length > 0 && (
        <div className={styles.reachable}>
          {counters.map((c) => (
            <span key={c.key} className={`${styles.counter} ${c.banked ? styles.banked : ""}`} title={c.banked ? "Déjà gagnée" : undefined}>
              <IconText text={c.text} /> {c.n}
            </span>
          ))}
        </div>
      )}
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
        <button
          className={styles.iconBtn}
          onClick={() => downloadText(backupFileName(kingdom), exportKingdom(kingdom, APP_VERSION))}
          aria-label="Sauvegarder le royaume"
          title="Sauvegarder le royaume"
        >
          <SaveIcon />
        </button>
        <button className={styles.iconBtn} onClick={() => setStatsOpen(true)} aria-label="Stats" title="Stats">
          <StatsIcon />
        </button>
        <button
          className={styles.iconBtn}
          aria-pressed={sortOpen}
          onClick={() => {
            setSortOpen((o) => !o);
            setSettingsOpen(false);
          }}
          aria-label="Trier les cartes"
          title="Trier les cartes"
        >
          <SortIcon />
        </button>
        {sortOpen && (
          <div className={`${styles.settings} ${styles.sortMenu}`} role="dialog" aria-label="Trier les cartes">
            {(
              [
                ["resources", "Ressources"],
                ["type", "Type de terrain"],
                ["arrival", "Ordre d'arrivée"],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className={styles.sortChoice}>
                <input
                  type="radio"
                  name="sort"
                  checked={sortMode === mode}
                  onChange={() => {
                    setSortPlay(mode);
                    setSortOpen(false);
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        )}
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
        <button
          className={styles.iconBtn}
          aria-pressed={settingsOpen}
          onClick={() => {
            setSettingsOpen((o) => !o);
            setSortOpen(false);
          }}
          aria-label="Réglages"
          title="Réglages"
        >
          <SettingsIcon />
        </button>
        {settingsOpen && (
          <div className={styles.settings} role="dialog" aria-label="Réglages">
            <div className={styles.settingsRow}>
              <span>Zoom</span>
              <span className={styles.settingsRow}>
                <button className={styles.iconBtn} onClick={() => setZoom(zoom - 0.1)} disabled={zoom <= ZOOM_MIN} aria-label="Dézoomer">
                  −
                </button>
                <span className={styles.zoomValue}>{Math.round(zoom * 100)} %</span>
                <button className={styles.iconBtn} onClick={() => setZoom(zoom + 0.1)} disabled={zoom >= ZOOM_MAX} aria-label="Zoomer">
                  +
                </button>
              </span>
            </div>
            <div className={styles.settingsRow}>
              <span>Thème</span>
              <span className={styles.segmented}>
                {(
                  [
                    ["auto", "Auto"],
                    ["light", "Clair"],
                    ["dark", "Sombre"],
                  ] as const
                ).map(([t, label]) => (
                  <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>
                    {label}
                  </button>
                ))}
              </span>
            </div>
            <label className={styles.settingsRow}>
              <span>Griser le bas des cartes</span>
              <input type="checkbox" checked={dimBottom} onChange={toggleDimBottom} />
            </label>
            <a
              className={styles.feedback}
              href={feedbackUrl(`${kingdom.name}, manche ${state.round}, tour ${state.turn}, graine ${state.config.seed}`)}
              target="_blank"
              rel="noreferrer"
            >
              Signaler un bug ou une idée
            </a>
          </div>
        )}
      </header>

      {state.zones.permanent.length > 0 && (
        <section className={styles.permanents} aria-label="Cartes permanentes">
          {state.zones.permanent.map((id) => card(id, 72, () => tapPermanent(id)))}
        </section>
      )}

      <aside className={styles.deckSlot}>
        {deck}
        {second && (
          <div className={styles.peek} aria-label="Deuxième carte de la pioche (Watchtower)">
            {card(second, 64, undefined, false)}
          </div>
        )}
      </aside>

      <div className={styles.resourceRow}>
        {resources}
        {roundBanner && (
          <div className={styles.roundBanner} key={roundBanner.key} role="status">
            {roundBanner.text}
          </div>
        )}
      </div>

      <main
        className={`${styles.play} ${zoom > 1 ? styles.playZoomed : ""}`}
        ref={(node) => {
          playEl.current = node;
          fitRef(node);
        }}
        aria-label="Zone de jeu"
      >
        {ordered.map((id, i) => {
          const held = state.blocks?.[id] ?? [];
          const peek = Math.round((cardWidth / CARD_ASPECT) * BLOCKED_PEEK);
          const main = card(id, cardWidth || undefined, (p) => tapCard(id, p), true, { engaged: engagedNow.includes(id), zones: true });
          const row =
            enemyRow && i === topCount ? (
              <div key="top-break" className={styles.rowBreak} />
            ) : i === spacerAt ? (
              <div key="top-spacer" style={{ width: TOP_SPACER - 12 }} />
            ) : null;
          if (held.length === 0) return row ? [row, main] : main;
          // Cartes bloquées : posées sous la bloquante, le haut dépasse (nom et bandeau lisibles).
          const stack = (
            <div key={id} className={styles.stack} style={{ paddingTop: peek * held.length }}>
              {held.map((b, j) => (
                <div key={b} className={styles.under} style={{ top: peek * j }}>
                  {card(b, cardWidth || undefined, undefined, true)}
                </div>
              ))}
              <div className={styles.over}>{main}</div>
            </div>
          );
          return row ? [row, stack] : stack;
        })}
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

      {bubble && <TranslationBubble catalog={catalog} state={state} {...bubble} />}

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
          onRun={(o) => (o.plan ? run(o.plan) : startPaying(selected.card, o))}
          onInspect={() => {
            setInspect(selected.card);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {statsOpen && <StatsDialog catalog={catalog} state={state} onClose={() => setStatsOpen(false)} onShowDestroyed={() => setDestroyedOpen(true)} />}
      {destroyedOpen && (
        <CardListDialog catalog={catalog} state={state} title="Détruites" cards={state.zones.destroyed} onInspect={setInspect} onClose={() => setDestroyedOpen(false)} />
      )}
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
      {state.pending && <DecisionDialog catalog={catalog} state={state} onAction={(a) => perform([a])} onRestart={restart} onInspect={setInspect} />}
      {inspect && <Inspector catalog={catalog} state={state} card={inspect} onClose={() => setInspect(null)} />}
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
    </div>
  );
}
