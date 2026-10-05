import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResourceId } from "../../data/schema";
import {
  actionCost,
  activeStage,
  applyAction,
  candidateActions,
  exhaustedEffects,
  isFullImageFace,
  paymentCandidates,
  canPeekSecond,
  gainEffectOf,
  sourceGroups,
  restrictionSources,
  boxViews,
  isOrderedTrack,
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
import { AdvanceIcon, CastleIcon, DevIcon, PassIcon, SaveIcon, SettingsIcon, SortIcon, StatsIcon, TranslateIcon, UndoIcon } from "../common/UiIcons";
import { downloadText } from "../common/download";
import { BugButton } from "../common/BugButton";
import { effectLines } from "../../data/textLines";
import { boxRects } from "../../data/checkboxes";
import { goalView } from "./goals";
import { costIconRects } from "../../data/upgradeIcons";
import { backupFileName, exportKingdom } from "../../persistence/backup";
import { playLayout } from "./sortCards";
import { BLOCKED_PEEK, CARD_ASPECT, type Slot } from "./fitCards";

/** Écart entre les ennemis et les cartes « stays in play » de la ligne du haut (px, écart des cartes compris). */
const TOP_SPACER = 40;
/** Écart entre deux demi-cartes « stays in play » empilées (px), et sa part d'une hauteur de carte pour le calcul. */
const STAY_COLUMN_GAP = 8;
const STAY_COLUMN_GAP_SHARE = 0.04;
import type { TapPoint } from "../common/usePress";
import { CardActions, type CardOption } from "./CardActions";
import { zoneAtCard, type ZoneKind } from "./cardZones";
import { ANIM_MS, CardView, type CardNote } from "./CardView";
import { CardListDialog, ConfirmDialog, DecisionDialog, EndDialog, Inspector, StatsDialog } from "./Dialogs";
import { DevBar } from "./DevTools";
import { frNote } from "./translationNote";
import { useGame } from "./store";
import { usePlayClock } from "./usePlayClock";
import { formatPlayTime } from "../../persistence/kingdoms";
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
  // Production, ou effet de gain au choix (Servant : {coin}/{wood}/{stone}) qui s'engage comme elle.
  const groups = sourceGroups(catalog, s, id);
  if (groups.length === 0) return null;
  const cost = gainEffectOf(catalog, s, id)?.cost ?? [];
  return (cost.length ? `${icons(cost)} → ` : "") + groups.map((g) => g.options.map((o) => icons(o)).join("/")).join(" + ");
}

/** Ce qu'une action coûte encore, une fois comptées les ressources en cours et les cartes engagées. */
function missingText(catalog: Catalog, s: GameState, a: Action, engaged: InstanceId[]): string {
  const cost = actionCost(catalog, s, a);
  if (!cost) return "Conditions non remplies";
  const have: Record<string, number> = { ...s.resources };
  // Cartes défaussées pour le coût en cartes (« 2 Persons ») ou visées : elles ne produisent pas (règle 4.4).
  const spent = [...("discard" in a ? a.discard : []), ...("targets" in a ? a.targets : [])];
  const pot = engagedPotential(catalog, s, engaged.filter((id) => (!("card" in a) || id !== a.card) && !spent.includes(id)));
  for (const [r, n] of Object.entries(pot.fixed)) have[r] = (have[r] ?? 0) + n;
  let flexible = pot.choices.length;
  const missing: ResourceId[] = [];
  for (const r of cost) {
    if ((have[r] ?? 0) > 0) have[r] = (have[r] ?? 0) - 1;
    else if (flexible > 0) flexible -= 1;
    else missing.push(r);
  }
  // Dépense d'un échange engagé (Bazaar) que rien ne couvre : elle manque aussi.
  for (const [r, n] of Object.entries(have)) {
    for (let i = 0; i < -n; i++) {
      if (flexible > 0) flexible -= 1;
      else missing.push(r as ResourceId);
    }
  }
  if (!missing.length) return "Pas payable avec les cartes engagées";
  // La carte de l'action ne peut pas payer avec sa propre production (produire la défausse).
  const own = "card" in a && productionGroups(catalog, s, a.card).some((g) => g.options.some((o) => o.some((r) => missing.includes(r))));
  // Une carte défaussée pour le coût en cartes ne peut pas aussi produire (Miners : 2 personnes ou sa {stone}).
  const both = spent.filter((id) => engaged.includes(id)).map((id) => cardName(catalog, s, id).replace(/ \(#\d+\)$/, ""));
  const why = own
    ? " (la carte ne peut pas payer avec sa propre production)"
    : both.length
      ? ` : ${both.join(", ")} est défaussée pour le coût en cartes, elle ne peut pas aussi produire`
      : "";
  return `Il manque ${icons(missing)}${why}`;
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
  // La carte de l'action d'abord, puis une autre carte en jeu retournée par l'effet (Missionary convertit le Bandit :
  // sans animation, le Bandit partait dans la défausse sous le Missionary sans qu'on le voie se retourner).
  const turned = [last.card, ...state.zones.play.filter((id) => id !== last.card)];
  for (const card of turned) {
    if (!state.zones.play.includes(card) && card !== last.card) continue;
    const before = instance(state, card).orientation;
    const after = instance(s, card).orientation;
    if (before.side !== after.side) return { card, kind: "flip", to: after };
    if (before.rotation !== after.rotation) return { card, kind: "rotate", to: after };
  }
  return null;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;


/** Pas de message après une action (demandes du 2026-10-02) : l'annulation reste dans la barre du haut. */
function toastFor(_action: Action | undefined): string {
  return "";
}

/** Cartes qu'une option demande de toucher : cibles d'un effet, ou cartes à défausser pour une amélioration. */
function cardsOfOption(o: CardOption): readonly InstanceId[] {
  return o.action.type === "useEffect" ? o.action.targets : o.action.type === "upgrade" ? o.action.discard : [];
}

export function GameScreen({ catalog, kingdomId }: { catalog: Catalog; kingdomId: string }) {
  const { status, kingdom, session, toast, engaged, flagged, load, perform, toggleEngaged, toggleFlag, restart, undo, dismissToast, addPlayTime } = useGame();
  // Chronomètre : seulement quand l'appli est à l'écran, jusqu'à la fin de la partie.
  const unsavedPlayMs = usePlayClock(status === "ready" && session !== null && current(session).phase !== "gameOver", addPlayTime);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [inspect, setInspect] = useState<InstanceId | null>(null);
  /** Mode développeur (demande du 2026-10-05) : hors règles, jamais sauvegardé (repart éteint). */
  const [devMode, setDevMode] = useState(false);
  const [devList, setDevList] = useState<"deck" | "box" | null>(null);
  /** Cartes inspectées avant un renvoi vers une carte citée (« ← Retour »). */
  const [inspectBack, setInspectBack] = useState<InstanceId[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [roundBanner, setRoundBanner] = useState<{ key: number; text: string } | null>(null);
  /** Texte posé sur une carte : traduction en mode FR, ou ce qui manque pour payer. */
  const [note, setNote] = useState<{ card: InstanceId; note: CardNote } | null>(null);
  const lastRound = useRef<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [endClosed, setEndClosed] = useState(false);
  // Une mini-extension relance la partie : sa fin rouvrira la fenêtre de fin.
  const playingNow = session ? current(session).phase === "playing" : false;
  useEffect(() => {
    if (playingNow) setEndClosed(false);
  }, [playingNow]);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [targeting, setTargeting] = useState<{ source: InstanceId; options: CardOption[] } | null>(null);
  /** Cartes déjà touchées pendant un ciblage à plusieurs cartes (amélioration qui coûte 2 personnes…). */
  const [targetPicks, setTargetPicks] = useState<InstanceId[]>([]);
  useEffect(() => setTargetPicks([]), [targeting]);
  /** Effet ou amélioration touché sans assez de ressources : on touche ensuite les cartes qui paient. */
  const [paying, setPaying] = useState<{ source: InstanceId; action: Action } | null>(null);
  /** Cartes qui tremblent « non » : l'ennemi ou l'événement qui interdit le geste tenté. */
  const [shaking, setShaking] = useState<InstanceId[]>([]);
  const shakeTimer = useRef<number | undefined>(undefined);
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
  // Emplacements de la zone de jeu : une carte, ou une colonne de deux demi-cartes « stays in play » (demandes du
  // 2026-10-04 : deux demi-cartes l'une sur l'autre ont à peu près la taille d'une carte ennemie, à côté de laquelle
  // elles se rangent). En colonnes seulement s'il y a un ennemi, ou si elles sont trop nombreuses pour une ligne (les
  // colonnes donnent alors de plus grandes cartes) ; sinon sur une ligne, comme avant. Une carte « stays in play » qui
  // en bloque d'autres garde sa propre colonne.
  const [fitRef, area] = useFitArea();
  const { items, cardWidth, enemyRow } = useMemo(() => {
    const build = (pair: boolean): InstanceId[][] => {
      const cols: InstanceId[][] = [];
      let open: InstanceId[] | null = null;
      for (const id of layout.stays) {
        const alone = !pair || (state?.blocks?.[id]?.length ?? 0) > 0 || !(state && showsTopHalfOnly(catalog, state, id));
        if (alone) {
          cols.push([id]);
          continue;
        }
        if (open && open.length < 2) open.push(id);
        else {
          open = [id];
          cols.push(open);
        }
      }
      return [...layout.enemies.map((id) => [id]), ...cols, ...layout.others.map((id) => [id])];
    };
    const height = (id: InstanceId) => (state && showsTopHalfOnly(catalog, state, id) ? 0.5 : 1) + BLOCKED_PEEK * (state?.blocks?.[id]?.length ?? 0);
    const spacer = layout.enemies.length > 0 && layout.stays.length > 0 ? layout.enemies.length : -1;
    const fit = (its: InstanceId[][]) => {
      const top = its.length - layout.others.length;
      // Colonnes (ennemi en jeu, ou demi-cartes appariées) : chaque colonne a au moins la hauteur d'une carte entière,
      // même avec une seule demi-carte (centrée) ; la compter comme une demi-carte faisait déborder la zone de jeu.
      const columns = layout.enemies.length > 0 || its.some((ids) => ids.length > 1);
      const isStay = (i: number) => i >= layout.enemies.length && i < top;
      const slots = (withBreak: boolean): Slot[] =>
        its.map((ids, i) => ({
          // Deux demi-cartes empilées : une carte, plus l'écart entre elles.
          h: ids.length > 1 ? 1 + STAY_COLUMN_GAP_SHARE : columns && isStay(i) ? Math.max(1, height(ids[0] ?? "")) : height(ids[0] ?? ""),
          breakBefore: withBreak && i === top,
          space: i === spacer ? TOP_SPACER : 0,
        }));
      const flat = cardWidthFor(area, slots(false), zoom);
      if (top === 0 || top === its.length) return { items: its, cardWidth: flat, enemyRow: false };
      const split = cardWidthFor(area, slots(true), zoom);
      return split >= 0.75 * flat ? { items: its, cardWidth: split, enemyRow: true } : { items: its, cardWidth: flat, enemyRow: false };
    };
    const line = fit(build(false));
    if (layout.stays.length < 2) return line;
    const paired = fit(build(true));
    return layout.enemies.length > 0 || paired.cardWidth > line.cardWidth * 1.02 ? paired : line;
  }, [layout, state, catalog, area, zoom]);
  const topCount = items.length - layout.others.length;
  /** Demi-cartes rangées en colonnes (ennemi présent, ou trop de cartes pour une ligne). */
  const stayColumns = layout.enemies.length > 0 || items.some((ids) => ids.length > 1);
  const spacerAt = layout.enemies.length > 0 && layout.stays.length > 0 ? layout.enemies.length : -1;
  useCardMotion(catalog, state, playEl);
  const playing = state?.phase === "playing" && !state.pending && !anim;
  // Choix de cartes en jeu demandé par un effet (« Destroy 1 person… ») : on touche les cartes sur le plateau, sans
  // fenêtre (demande du 2026-10-03). Quand le nombre est imposé, ou qu'on peut refuser (« stay in play » : bouton en
  // bas, demande du 2026-10-04) ; sinon la fenêtre de choix reste.
  const boardChoice = useMemo(() => {
    const p = state?.pending;
    if (!state || anim || p?.kind !== "choice" || p.request.type !== "cards") return null;
    const r = p.request;
    const onBoard = r.options.every((id) => state.zones.play.includes(id) || state.zones.permanent.includes(id));
    if (!onBoard || r.min < 1 || (r.min !== r.max && r.none === undefined && r.need === undefined)) return null;
    // Choix pondéré (Miners compte pour 2 personnes) : il part dès que le total est atteint.
    const weight = (id: InstanceId) => (r.need !== undefined ? (r.weights?.[id] ?? 1) : 1);
    return { options: new Set(r.options), min: r.min, count: r.need ?? r.max, weight, none: r.none ?? null, cancellable: p.cancellable, source: p.source };
  }, [state, anim]);
  const [picked, setPicked] = useState<InstanceId[]>([]);
  useEffect(() => setPicked([]), [state?.pending]);
  // Question « quelle case ? » d'une carte sur le plateau (Merchant, Prison…) : on touche la case sur la carte.
  const boxChoice = useMemo(() => {
    const p = state?.pending;
    if (!state || anim || p?.kind !== "choice" || p.request.type !== "option" || !p.request.boxes?.length) return null;
    const card = p.request.card ?? p.source;
    if (!state.zones.play.includes(card) && !state.zones.permanent.includes(card)) return null;
    const decline = p.request.labels.lastIndexOf("Non");
    return { source: card, boxes: p.request.boxes, spots: p.request.spots ?? "checkbox", decline: decline >= 0 ? decline : null, cancellable: p.cancellable };
  }, [state, anim]);

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


  /** Partie et écran au moment d'un signalement de bug : de quoi rejouer et revoir la situation. */
  const bugContext = () =>
    state && kingdom
      ? {
          kingdom: { id: kingdom.id, name: kingdom.name, record: kingdom.record },
          state,
          where: `manche ${state.round}, tour ${state.turn}, ${state.phase}`,
          screen: {
            pending: state.pending?.kind ?? null,
            selected: selected?.card ?? null,
            engaged: engagedNow,
            paying: paying ? { source: paying.source, action: paying.action } : null,
            targeting: targeting?.source ?? null,
            inspect,
            note: note ? { card: note.card, text: note.note.text } : null,
            discardOpen,
            statsOpen,
            tooltipsFr,
            zoom,
          },
          log: state.log.slice(-25).map((l) => `M${l.round} T${l.turn} ${l.text}`),
        }
      : undefined;

  const advance = legal.find((a) => a.type === "advance");
  const pass = legal.find((a) => a.type === "pass");

  /** Geste interdit par un ennemi ou un événement (demande du 2026-10-03) : la carte responsable tremble. */
  const refuse = useCallback((ids: readonly InstanceId[]): boolean => {
    if (ids.length === 0) return false;
    window.clearTimeout(shakeTimer.current);
    setShaking([...ids]);
    shakeTimer.current = window.setTimeout(() => setShaking([]), 650);
    return true;
  }, []);
  const advanceBlockers = useMemo(() => (state && !advance ? restrictionSources(catalog, state).advance : []), [catalog, state, advance]);
  const tryAdvance = useCallback(() => {
    if (advance) run([advance]);
    else refuse(advanceBlockers);
  }, [advance, run, refuse, advanceBlockers]);

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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || pending || inspect || discardOpen || state?.pending || anim || targeting || paying) return;
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if ((key === "z" && mod) || (key === "u" && !mod)) {
        e.preventDefault();
        undo();
      } else if (key === "a" && !mod) tryAdvance();
      else if (key === "p" && !mod && pass) run([pass]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tryAdvance, pass, run, undo, pending, inspect, discardOpen, state?.pending, anim, targeting, paying]);

  // Texte sur une carte : il part au toucher suivant (ou après 4 s pour « il manque ») ; le mode FR coupé l'efface.
  useEffect(() => {
    if (!note) return;
    const close = () => setNote(null);
    const t = note.note.tone === "warn" ? window.setTimeout(close, 4000) : undefined;
    window.addEventListener("pointerdown", close, { capture: true, once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", close, { capture: true });
    };
  }, [note]);
  useEffect(() => {
    if (!tooltipsFr) setNote((n) => (n?.note.tone === "fr" ? null : n));
  }, [tooltipsFr]);

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

  /** Lignes de texte mesurées de chaque effet du stage visible. */
  const linesOf = (card: InstanceId) => {
    const stage = activeStage(catalog, state, card);
    const t = tpl(card);
    return (stage?.effects ?? []).map((e) => ({ id: e.id, lines: stage ? (effectLines(t.expansion, t.serial, stage.id, e.id) ?? []) : [] }));
  };

  /** Le doigt est sur une ligne de texte d'effet (marge large : un doigt sur iPad couvre plus d'une ligne). */
  const onEffectText = (card: InstanceId, p: TapPoint): boolean =>
    linesOf(card).some(({ lines }) => lines.some((l) => p.y >= l[0] - 0.02 && p.y <= l[1] + 0.02 && p.x >= l[2] - 0.04 && p.x <= l[3] + 0.04));

  /**
   * Effet visé par un toucher, parmi ceux qu'on peut lancer : le plus proche du doigt en hauteur. La zone de texte
   * est ainsi partagée entre les effets utilisables, frontière à mi-chemin (demande du 2026-10-03 : imprécis sur iPad).
   */
  const effectAt = (card: InstanceId, y: number, among: ReadonlySet<string>): string | null => {
    let best: { id: string; d: number } | null = null;
    for (const { id, lines } of linesOf(card)) {
      if (!among.has(id) || lines.length === 0) continue;
      const top = Math.min(...lines.map((l) => l[0]));
      const bottom = Math.max(...lines.map((l) => l[1]));
      const d = y < top ? top - y : y > bottom ? y - bottom : 0;
      if (!best || d < best.d) best = { id, d };
    }
    return best?.id ?? null;
  };

  /** Ennemis qui interdisent la zone touchée (Dark Prince : ni amélioration ni effet {time}). */
  const forbiddenBy = (card: InstanceId, zone: ZoneKind): InstanceId[] => {
    const stage = activeStage(catalog, state, card);
    if (!stage) return [];
    const src = restrictionSources(catalog, state);
    if ((zone === "upgradeFlip" || zone === "upgradeRotate") && stage.upgrades.length > 0) return src.upgrade;
    if (zone === "effect" && stage.effects.some((e) => e.type === "time")) return src.time;
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
  // Options encore possibles avec les cartes déjà touchées, et les cartes qu'on peut toucher ensuite.
  const targetCandidates = (targeting?.options ?? []).filter((o) => targetPicks.every((c) => cardsOfOption(o).includes(c)));
  const targetOptions = new Map<InstanceId, CardOption>(
    targetCandidates.flatMap((o) => cardsOfOption(o).filter((c) => !targetPicks.includes(c)).map((c) => [c, o] as const)),
  );
  const targetsInDiscard = [...targetOptions.keys()].filter((id) => state.zones.discard.includes(id));

  /** Mode FR : la traduction de la moitié touchée s'affiche sur la carte. */
  const showTranslation = (card: InstanceId, p: TapPoint) => {
    const n = frNote(tpl(card), instance(state, card).orientation, p.y < 0.5 ? "top" : "bottom");
    if (n) setNote({ card, note: n });
  };

  /** Action impayable : ce qui manque s'affiche sur la carte quelques secondes (pas de fenêtre). */
  /** Action impayable : la carte fait « non » et dit ce qui manque (demande du 2026-10-03 : ce n'est pas un bug). */
  const showMissing = (card: InstanceId, o: CardOption, p: TapPoint) => {
    refuse([card]);
    setNote({ card, note: { half: p.y < 0.5 ? "top" : "bottom", text: o.reason ?? "Impossible pour l'instant", tone: "warn" } });
  };

  /** La zone touchée porte-t-elle une action de la carte (effet à lancer, amélioration) ? */
  const hasActionAt = (card: InstanceId, zone: ZoneKind): boolean => {
    const stage = activeStage(catalog, state, card);
    if (!stage) return false;
    if (zone === "upgradeFlip" || zone === "upgradeRotate") return stage.upgrades.length > 0;
    return zone === "effect" && stage.effects.some((e) => e.type === "activated" || e.type === "time" || e.type === "destroy");
  };

  /** Cartes visées par l'action en attente de paiement (Priest : la carte améliorée ; coût en personnes). */
  const payingTargets: InstanceId[] = paying
    ? [...("targets" in paying.action ? paying.action.targets : []), ...("discard" in paying.action ? paying.action.discard : [])]
    : [];

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

  /** Case de l'étape visible touchée (positions mesurées, marge pour le doigt), ou null. */
  const boxAt = (card: InstanceId, p: TapPoint): string | null => {
    const stage = activeStage(catalog, state, card);
    const t = tpl(card);
    const rects = stage ? boxRects(t.expansion, t.serial, stage.id) : undefined;
    if (!stage || !rects) return null;
    let best: { id: string; d: number } | null = null;
    stage.checkboxes.forEach((b, i) => {
      const r = rects[i];
      if (!r) return;
      const [cx, cy] = [r[0] + r[2] / 2, r[1] + r[3] / 2];
      const inside = Math.abs(p.x - cx) <= r[2] * 0.85 && Math.abs(p.y - cy) <= r[3] * 0.85;
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (inside && (!best || d < best.d)) best = { id: b.id, d };
    });
    return (best as { id: string } | null)?.id ?? null;
  };

  /** Icône de coût la plus proche du doigt, parmi celles proposées (Royal Visit). */
  const costAt = (card: InstanceId, p: TapPoint, keys: readonly string[]): string | null => {
    const stage = activeStage(catalog, state, card);
    const t = tpl(card);
    if (!stage) return null;
    let best: { key: string; d: number } | null = null;
    for (const key of keys) {
      const [, u, i] = key.split("/");
      const r = costIconRects(t.expansion, t.serial, stage.id, u ?? "")?.[Number(i)];
      if (!r) continue;
      const d = Math.hypot(p.x - (r[0] + r[2] / 2), p.y - (r[1] + r[3] / 2));
      if (d < 0.12 && (!best || d < best.d)) best = { key, d };
    }
    // Icônes non mesurées : la première proposée.
    if (!best && keys.every((k) => !costIconRects(t.expansion, t.serial, stage.id, k.split("/")[1] ?? ""))) return keys[0] ?? null;
    return best?.key ?? null;
  };

  /**
   * Toucher une case (demande du 2026-10-03) : répond à la question « quelle case ? » en cours ; sinon lance l'effet
   * de la carte qui coche des cases, la case touchée choisissant le bonus. Renvoie true si le toucher est pris.
   */
  const tapBox = (card: InstanceId, p: TapPoint): boolean => {
    if (boxChoice) {
      const box = card !== boxChoice.source ? null : boxChoice.spots === "cost" ? costAt(card, p, boxChoice.boxes) : boxAt(card, p);
      if (box && boxChoice.boxes.includes(box)) run([{ type: "choose", answer: { box } }]);
      else if (boxChoice.decline !== null) run([{ type: "choose", answer: { option: boxChoice.decline } }]);
      else if (boxChoice.cancellable) perform([{ type: "cancelChoice" }]);
      return true;
    }
    if (!playing || tooltipsFr) return false;
    const box = boxAt(card, p);
    if (!box) return false;
    const stage = activeStage(catalog, state, card);
    const marking = optionsFor(card).filter(
      (o) => o.action.type === "useEffect" && stage?.effects.some((e) => o.action.type === "useEffect" && e.id === o.action.effect && e.text.includes("{mark}")),
    );
    const o = marking[0];
    if (!o) return false;
    if (!o.plan) {
      if (!startPaying(card, o)) showMissing(card, o, p);
      return true;
    }
    // Case au choix : la case touchée répond à la question « quelle case ? » de l'effet, dès qu'elle est posée (Prison
    // demande d'abord l'ennemi : la case touchée attend). Piste ordonnée : c'est la case suivante qui est cochée.
    if (stage && !isOrderedTrack(stage)) {
      const after = o.plan.reduce((st, a) => applyAction(catalog, st, a), state);
      const req = after.pending?.kind === "choice" ? after.pending.request : null;
      if (req?.type === "option" && req.boxes?.includes(box)) {
        run([...o.plan, { type: "choose", answer: { box } }]);
        return true;
      }
    }
    run(o.plan);
    return true;
  };

  /** Choix sur le plateau : la carte touchée est choisie (ou rendue) ; le compte atteint, la réponse part. */
  const pickOnBoard = (card: InstanceId): boolean => {
    if (!boardChoice) return false;
    if (!boardChoice.options.has(card)) {
      if (boardChoice.cancellable) perform([{ type: "cancelChoice" }]);
      return true;
    }
    const next = picked.includes(card) ? picked.filter((c) => c !== card) : [...picked, card];
    if (next.reduce((n, c) => n + boardChoice.weight(c), 0) >= boardChoice.count) {
      setPicked([]);
      run([{ type: "choose", answer: { cards: next } }]);
    } else setPicked(next);
    return true;
  };

  const tapCard = (card: InstanceId, p: TapPoint) => {
    // Mode dev : toucher une carte ouvre ses gestes hors règles (dans l'inspection).
    if (devMode) {
      setInspect(card);
      return;
    }
    if (pickOnBoard(card)) return;
    if (!paying && !targeting && tapBox(card, p)) return;
    if (paying) {
      // Carte déjà choisie pour payer : la toucher la rend (coche verte retirée).
      if (engagedNow.includes(card)) {
        toggleEngaged(card);
        return;
      }
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
      if (targetPicks.includes(card)) {
        setTargetPicks(targetPicks.filter((c) => c !== card));
        return;
      }
      if (!targetOptions.has(card)) {
        setTargeting(null);
        return;
      }
      const next = [...targetPicks, card];
      const done = targetCandidates.find((o) => cardsOfOption(o).length === next.length && next.every((c) => cardsOfOption(o).includes(c)));
      if (!done) {
        setTargetPicks(next);
        return;
      }
      const source = targeting.source;
      setTargeting(null);
      if (done.plan) run(done.plan);
      else if (!startPaying(source, done)) showMissing(source, done, { x: 0.5, y: 0.25 });
      return;
    }
    if (!playing) return;
    // Mode FR (bouton FR) : toucher une carte montre sa traduction, sans jouer.
    if (tooltipsFr) {
      showTranslation(card, p);
      return;
    }
    const grid = zoneAtCard(p.x, p.y, isFullImageFace(tpl(card), instance(state, card).orientation.side));
    // Un toucher sur le texte d'un effet vise l'effet, même là où la grille voit la production.
    const zone: ZoneKind = grid !== "upgradeFlip" && grid !== "upgradeRotate" && onEffectText(card, p) ? "effect" : grid;
    if (zone === "production" && productionLabel(catalog, state, card)) {
      toggleEngaged(card);
      return;
    }
    // Effet de gain au choix (Servant, Investor…) : la carte s'engage, ses ressources s'ajoutent en haut, sans fenêtre.
    const gain = gainEffectOf(catalog, state, card);
    if (gain && zone === "effect") {
      const usable = new Set(optionsFor(card).flatMap((o) => (o.action.type === "useEffect" ? [o.action.effect] : [])));
      usable.add(gain.effect);
      if (usable.size === 1 || effectAt(card, p.y, usable) === gain.effect) {
        toggleEngaged(card);
        return;
      }
    }
    if (zone === "upgradeFlip" || zone === "upgradeRotate" || zone === "effect") {
      let opts = zoneOptions(card, zone);
      // Plusieurs effets sur la carte (Witch Cabin…) : celui dont on a touché le texte, sans menu.
      const effects = new Set(opts.map((o) => (o.action.type === "useEffect" ? o.action.effect : "")));
      if (zone === "effect" && effects.size > 1) {
        const at = effectAt(card, p.y, effects);
        if (at) opts = opts.filter((o) => o.action.type === "useEffect" && o.action.effect === at);
        if (opts.length === 0) return;
      }
      if (opts.length === 0) {
        // Un ennemi l'interdit : c'est lui qui fait « non » ; sinon la carte elle-même (condition non remplie : pas
        // 6 cartes amies, plus rien à découvrir…).
        if (!refuse(forbiddenBy(card, zone)) && hasActionAt(card, zone)) refuse([card]);
        return;
      }
      const only = opts[0];
      if (opts.length === 1 && only) {
        if (only.plan) run(only.plan);
        else if (!startPaying(card, only)) showMissing(card, only, p);
        return;
      }
      // Effet à cible (« Discard a friendly card ») ou amélioration qui coûte des cartes (« 1 Person ») : toucher la
      // zone, puis la ou les cartes visées sur le plateau, sans menu (demande du 2026-10-03).
      if (opts.length > 1 && opts.every((o) => cardsOfOption(o).length > 0)) {
        setSelected(null);
        setTargeting({ source: card, options: opts });
        return;
      }
      // Plusieurs choix sans cible (ex. Bazaar : bois ou pierre) : petit menu de choix.
      if (opts.length > 1) openMenu(card);
    }
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
      picked={picked.includes(id) || targetPicks.includes(id) || (paying !== null && (engagedNow.includes(id) || payingTargets.includes(id)))}
      engaged={extra?.engaged}
      flagged={extra?.zones ? flagged.includes(id) : undefined}
      onTwoFinger={extra?.zones ? () => toggleFlag(id) : undefined}
      dimBottom={dimBottom && extra?.zones !== false}
      targetable={boardChoice ? boardChoice.options.has(id) && !picked.includes(id) : targeting ? targetOptions.has(id) : paying ? payers.has(id) : undefined}
      dimmed={
        boardChoice
          ? !boardChoice.options.has(id) && id !== boardChoice.source
          : targeting
            ? !targetOptions.has(id) && !targetPicks.includes(id) && id !== targeting.source
            : paying
              ? !payers.has(id) && id !== paying.source && !engagedNow.includes(id) && !payingTargets.includes(id)
              : undefined
      }
      badge={badgeFor(id, extra?.engaged ?? false)}
      onTap={onTap}
      onLongPress={inspectable ? () => setInspect(id) : undefined}
      zoneLabel={extra?.zones ? zoneLabel(id) : undefined}
      anim={anim?.card === id ? { kind: anim.kind, to: anim.to } : undefined}
      stickers={instance(state, id).stickers}
      half={extra?.zones ? showsTopHalfOnly(catalog, state, id) : undefined}
      note={note?.card === id ? note.note : undefined}
      exhausted={(stage) => exhaustedEffects(catalog, state, id, stage)}
      boxes={(stage) => boxViews(catalog, state, id, stage)}
      pickBoxes={boxChoice?.source === id && boxChoice.spots === "checkbox" ? boxChoice.boxes : undefined}
      pickCosts={boxChoice?.source === id && boxChoice.spots === "cost" ? boxChoice.boxes : undefined}
      crossedCosts={instance(state, id).crossedOutCosts}
      shake={shaking.includes(id)}
      goal={goalView(catalog, state, kingdom?.goals ?? [], id)}
    />
  );

  /** Pastille : ressource engagée, cartes bloquées, cases cochées, compteur, stickers du stage visible. */
  const badgeFor = (id: InstanceId, isEngaged: boolean) => {
    const parts = cardBadges(catalog, state, id);
    if (isEngaged) parts.unshift(`engagée ${productionLabel(catalog, state, id) ?? ""}`);
    // Une ligne par information : la pastille reste étroite, même sur les petites cartes permanentes.
    const lines = parts.flatMap((p) => p.split("\n"));
    return lines.length ? (
      <>
        {lines.map((l, i) => (
          <span key={i} className={styles.badgeLine}>
            <IconText text={l} />
          </span>
        ))}
      </>
    ) : undefined;
  };

  /**
   * Carte permanente touchée : son effet (Army, Treasury…). Payable : il part ; il manque des ressources : les cartes
   * qui peuvent payer s'allument ; plusieurs effets : le menu. Sans effet : l'inspection (appui long aussi).
   */
  const tapPermanent = (id: InstanceId, p?: TapPoint) => {
    if (devMode) {
      setInspect(id);
      return;
    }
    if (pickOnBoard(id)) return;
    if (p && !paying && !targeting && tapBox(id, p)) return;
    // Mode FR : l'inspection montre la carte en grand, traduite.
    if (tooltipsFr) {
      setInspect(id);
      return;
    }
    let opts = playing ? optionsFor(id) : [];
    // Plusieurs effets : celui le plus proche du doigt.
    const effects = new Set(opts.map((o) => (o.action.type === "useEffect" ? o.action.effect : "")));
    if (p && effects.size > 1) {
      const at = effectAt(id, p.y, effects);
      if (at) opts = opts.filter((o) => o.action.type === "useEffect" && o.action.effect === at);
    }
    const only = opts[0];
    if (opts.length === 1 && only) {
      if (only.plan) run(only.plan);
      else if (!startPaying(id, only)) showMissing(id, only, { x: 0.5, y: 0.25 });
      return;
    }
    if (opts.length > 1) openMenu(id);
    else if (!(playing && (refuse(forbiddenBy(id, "effect")) || (hasActionAt(id, "effect") && refuse([id]))))) setInspect(id);
  };

  const fame = computeScore(catalog, state).total;
  // Permanentes (demande du 2026-10-03) : à gauche celles où l'on accumule des ressources (Army, Treasury, Export…),
  // à droite les objectifs, les autres entre les deux.
  const permanentGroups = (() => {
    const out = { accumulate: [] as InstanceId[], other: [] as InstanceId[], goals: [] as InstanceId[] };
    for (const id of state.zones.permanent) {
      const stage = activeStage(catalog, state, id);
      if (stage?.keywords.includes("Goal")) out.goals.push(id);
      else if (stage && (stage.checkboxes.length > 0 || stage.effects.some((e) => /keep track/i.test(e.text)))) out.accumulate.push(id);
      else out.other.push(id);
    }
    return out;
  })();
  const top = state.zones.deck[0];
  const second = canPeekSecond(catalog, state) ? state.zones.deck[1] : undefined;
  const lastDiscard = state.zones.discard.at(-1);
  const potential = engagedPotential(catalog, state, engagedNow);

  const deck = (
    <div className={styles.pile} aria-label={`Deck : ${state.zones.deck.length} cartes`}>
      <span className={styles.pileTitle}>Deck · {state.zones.deck.length}</span>
      {top ? (
        <div data-pile="deck">{card(top, undefined, devMode ? () => setDevList("deck") : playing && (advance || advanceBlockers.length) ? tryAdvance : undefined, false)}</div>
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
    // Seulement la production : un effet de gain (Servant…) n'apparaît qu'une fois touché, sur la carte engagée.
    state.zones.play.filter((id) => !engagedNow.includes(id) && productionGroups(catalog, state, id).length > 0),
  );
  const counters = [
    ...catalog.resources.flatMap((r) => {
      const banked = (state.resources[r] ?? 0) + (potential.fixed[r] ?? 0);
      const total = banked + (available.fixed[r] ?? 0);
      return total > 0 ? [{ key: r, text: `{${r}}`, n: total, banked: banked > 0 }] : [];
    }),
    ...potential.choices.map((opts, i) => ({ key: `e${i}`, text: opts.map((o) => icons(o)).join("/"), n: 1, banked: true })),
    ...available.choices.map((opts, i) => ({ key: `c${i}`, text: opts.map((o) => icons(o)).join("/"), n: 1, banked: false })),
  ];
  const resources = (
    <div className={styles.resources} aria-label="Ressources">
      {boxChoice && state.pending?.kind === "choice" && (
        <div className={styles.pickCounter}>
          <IconText text={state.pending.request.prompt} />
        </div>
      )}
      {boardChoice && state.pending?.kind === "choice" && (
        // Choix sur le plateau en cours : ce qu'il faut toucher et combien de cartes sont déjà choisies.
        <div className={styles.pickCounter}>
          <IconText text={state.pending.request.prompt} /> <strong>{picked.reduce((n, c) => n + boardChoice.weight(c), 0)}/{boardChoice.count}</strong>
        </div>
      )}
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
          <small className={styles.clock} title="Temps de jeu (appli à l'écran)">
            ⏱ {formatPlayTime((kingdom.playMs ?? 0) + unsavedPlayMs)}
          </small>
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
          className={`${styles.iconBtn} ${styles.aboveDialogs} ${devMode ? styles.devOn : ""}`}
          aria-pressed={devMode}
          onClick={() => setDevMode((d) => !d)}
          aria-label="Mode développeur"
          title="Mode développeur : outrepasser les règles"
        >
          <DevIcon />
        </button>
        <BugButton className={`${styles.iconBtn} ${styles.aboveDialogs}`} game={bugContext} />
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
          </div>
        )}
      </header>

      {state.zones.permanent.length > 0 && (
        <section className={styles.permanents} aria-label="Cartes permanentes">
          {permanentGroups.accumulate.map((id) => card(id, 72, (p) => tapPermanent(id, p)))}
          {permanentGroups.other.map((id) => card(id, 72, (p) => tapPermanent(id, p)))}
          {permanentGroups.goals.length > 0 && <span className={styles.permanentSpacer} />}
          {permanentGroups.goals.map((id) => card(id, 72, (p) => tapPermanent(id, p)))}
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
        onClick={(e) => {
          // Toucher le fond de la zone de jeu annule le choix des cartes qui paient ou de la cible.
          if (e.target !== e.currentTarget) return;
          setPaying(null);
          setTargeting(null);
          if (boardChoice?.cancellable) perform([{ type: "cancelChoice" }]);
        }}
      >
        {items.map((ids, i) => {
          const peek = Math.round((cardWidth / CARD_ASPECT) * BLOCKED_PEEK);
          const one = (id: InstanceId) => {
            const held = state.blocks?.[id] ?? [];
            const main = card(id, cardWidth || undefined, (p) => tapCard(id, p), true, { engaged: engagedNow.includes(id), zones: true });
            if (held.length === 0) return main;
            // Cartes bloquées : posées sous la bloquante, le haut dépasse (nom et bandeau lisibles).
            return (
              <div key={id} className={styles.stack} style={{ paddingTop: peek * held.length }}>
                {held.map((b, j) => (
                  <div key={b} className={styles.under} style={{ top: peek * j }}>
                    {card(b, cardWidth || undefined, () => refuse([id]), true)}
                  </div>
                ))}
                <div className={styles.over}>{main}</div>
              </div>
            );
          };
          const row =
            enemyRow && i === topCount ? (
              <div key="top-break" className={styles.rowBreak} />
            ) : i === spacerAt ? (
              <div key="top-spacer" style={{ width: TOP_SPACER - 12 }} />
            ) : null;
          // Demi-cartes « stays in play » : en colonne, centrées sur la hauteur d'une carte entière.
          const item =
            stayColumns && i >= layout.enemies.length && i < topCount ? (
              <div key={`col-${ids[0]}`} className={styles.stayColumn} style={{ minHeight: cardWidth ? cardWidth / CARD_ASPECT : undefined, gap: STAY_COLUMN_GAP }}>
                {ids.map(one)}
              </div>
            ) : (
              one(ids[0] ?? "")
            );
          return row ? [row, item] : item;
        })}
      </main>

      <aside className={styles.discardSlot}>{discard}</aside>

      <div className={styles.turnButtons}>
        {boardChoice?.none != null ? (
          // Choix qu'on peut refuser (« stay in play ») : le refus, ou la validation quand une partie est choisie.
          picked.length === 0 ? (
            <button className={styles.turnBtn} onClick={() => run([{ type: "choose", answer: { cards: [] } }])}>
              {boardChoice.none}
            </button>
          ) : (
            <button
              className={`${styles.turnBtn} ${styles.turnBtnPrimary}`}
              disabled={picked.length < boardChoice.min}
              onClick={() => {
                const cards = picked;
                setPicked([]);
                run([{ type: "choose", answer: { cards } }]);
              }}
            >
              Valider ({picked.length})
            </button>
          )
        ) : (
          <>
            <button className={styles.turnBtn} disabled={!playing || (!advance && advanceBlockers.length === 0)} onClick={tryAdvance} title="Avancer (A)">
              <AdvanceIcon /> Avancer
            </button>
            <button className={`${styles.turnBtn} ${styles.turnBtnPrimary}`} disabled={!playing || !pass} onClick={() => pass && run([pass])} title="Passer (P)">
              Passer <PassIcon />
            </button>
          </>
        )}
      </div>


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
      {statsOpen && <StatsDialog catalog={catalog} state={state} onClose={() => setStatsOpen(false)} onShowDestroyed={() => setDestroyedOpen(true)} onInspect={setInspect} />}
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
      {state.pending && !boardChoice && !boxChoice && <DecisionDialog catalog={catalog} state={state} onAction={(a) => perform([a])} onRestart={restart} onInspect={setInspect} />}
      {devMode && (
        <DevBar catalog={catalog} state={state} onAction={(a) => perform([a])} onShowDeck={() => setDevList("deck")} onShowBox={() => setDevList("box")} />
      )}
      {devMode && devList && (
        <CardListDialog
          catalog={catalog}
          state={state}
          title={devList === "deck" ? "Pioche (dessus en dernier)" : "Boîte"}
          cards={devList === "deck" ? state.zones.deck : state.zones.box.filter((id) => instance(state, id).serial > 0)}
          onInspect={setInspect}
          onClose={() => setDevList(null)}
        />
      )}
      {inspect && (
        <Inspector
          key={inspect}
          dev={devMode ? (a) => perform([a]) : undefined}
          onAction={(a) => perform([a])}
          catalog={catalog}
          state={state}
          card={inspect}
          onClose={() => {
            setInspect(null);
            setInspectBack([]);
          }}
          onOpen={(id) => {
            setInspectBack((b) => [...b, inspect]);
            setInspect(id);
          }}
          onBack={
            inspectBack.length
              ? () => {
                  setInspect(inspectBack.at(-1) ?? null);
                  setInspectBack((b) => b.slice(0, -1));
                }
              : undefined
          }
        />
      )}
      {state.phase === "gameOver" && !endClosed && (
        <EndDialog
          catalog={catalog}
          state={state}
          onBack={() => (window.location.hash = "#/")}
          onClose={() => setEndClosed(true)}
          onAction={(a) => perform([a], "")}
        />
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
