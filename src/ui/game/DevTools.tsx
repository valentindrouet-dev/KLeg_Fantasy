import { useEffect, useRef, type ReactNode } from "react";
import { orientationKey } from "../../data/schema";
import { activeStage, checkKey, isLegal, instance, template, validOrientations, zoneOf, type Action, type Catalog, type GameState, type InstanceId, type ManualOp, type Zone } from "../../engine";
import { Icon, StickerIcon } from "../common/IconText";
import styles from "./Game.module.css";

// Mode développeur (demande du 2026-10-05) : hors des règles, pour se dépanner quand un effet ne marche pas. Chaque
// geste est une action « manual » du moteur : enregistrée, annulable, sauvegardée et rejouée comme les autres.

const manual = (op: ManualOp): Action => ({ type: "manual", op });

const MOVES: { label: string; to: Zone; position?: "top" | "bottom" }[] = [
  { label: "En jeu", to: "play" },
  { label: "Défausse", to: "discard" },
  { label: "Dessus de la pioche", to: "deck", position: "top" },
  { label: "Dessous de la pioche", to: "deck", position: "bottom" },
  { label: "Permanente", to: "permanent" },
  { label: "Détruire", to: "destroyed" },
  { label: "Dans la boîte", to: "box" },
];

const RESOURCE_STICKERS: [string, string][] = [
  ["1", "coin"],
  ["2", "wood"],
  ["3", "stone"],
  ["4", "metal"],
  ["5", "sword"],
  ["6", "tradeGood"],
];

/** Gestes du mode dev sur une carte, dans son inspection. */
export function DevCardTools({ catalog, state, card, onAction }: { catalog: Catalog; state: GameState; card: InstanceId; onAction: (a: Action) => void }) {
  const ok = (op: ManualOp) => isLegal(catalog, state, manual(op));
  const button = (key: string, label: ReactNode, op: ManualOp, extra?: { active?: boolean }) => (
    <button key={key} className={`${styles.devBtn} ${extra?.active ? styles.devBtnOn : ""}`} disabled={!ok(op)} onClick={() => onAction(manual(op))}>
      {label}
    </button>
  );
  const c = instance(state, card);
  const t = template(catalog, c.templateId);
  const zone = zoneOf(state, card);
  const stage = activeStage(catalog, state, card);
  if (state.pending) {
    return <div className={styles.devTools}>Mode dev : une question est en cours. Passe-la avec « Passer la question » (barre dev) pour modifier les cartes.</div>;
  }
  return (
    <div className={styles.devTools}>
      <div className={styles.devRow}>
        <span className={styles.devLabel}>Zone</span>
        {zone === "box" && button("discover", "Découvrir", { kind: "discover", card })}
        {MOVES.map((m) => button(`${m.to}-${m.position ?? ""}`, m.label, { kind: "move", card, to: m.to, position: m.position ?? "bottom" }))}
      </div>
      <div className={styles.devRow}>
        <span className={styles.devLabel}>Étape</span>
        {validOrientations(catalog, state, card).map((o) => {
          const id = t.orientationToStage[`${o.side}-${o.rotation}`];
          const name = id ? t.stages[String(id) as "1"]?.name : "";
          const current = orientationKey(o) === orientationKey(c.orientation);
          return button(orientationKey(o), `${id} · ${name}`, { kind: "orient", card, orientation: o }, { active: current });
        })}
      </div>
      {stage && stage.checkboxes.length > 0 && (
        <div className={styles.devRow}>
          <span className={styles.devLabel}>Cases</span>
          {stage.checkboxes.map((b, i) =>
            button(b.id, `${c.checkedBoxes.includes(checkKey(stage.id, b.id)) ? "☑" : "☐"} ${i + 1}`, { kind: "check", card, box: b.id }, { active: c.checkedBoxes.includes(checkKey(stage.id, b.id)) }),
          )}
        </div>
      )}
      <div className={styles.devRow}>
        <span className={styles.devLabel}>Stickers</span>
        {RESOURCE_STICKERS.map(([n, r]) =>
          button(`s${n}`, <>{n} <Icon id={r} /></>, { kind: "sticker", card, sticker: n, resource: r, fame: null }),
        )}
        {button("s8", <>8 <StickerIcon id="8" /></>, { kind: "sticker", card, sticker: "8", resource: null, fame: 2 })}
        {button("s10", <>10 <StickerIcon id="10" /></>, { kind: "sticker", card, sticker: "10", resource: null, fame: 5 })}
      </div>
      <div className={styles.devRow}>
        <span className={styles.devLabel}>Effets</span>
        {button("refresh", "Rendre les effets rayés utilisables", { kind: "refresh", card })}
      </div>
    </div>
  );
}

/** Barre du mode dev : ressources gratuites, pioche et boîte, question bloquée. */
export function DevBar({
  catalog,
  state,
  onAction,
  onShowDeck,
  onShowBox,
}: {
  catalog: Catalog;
  state: GameState;
  onAction: (a: Action) => void;
  onShowDeck: () => void;
  onShowBox: () => void;
}) {
  const ok = (op: ManualOp) => isLegal(catalog, state, manual(op));
  // Les fenêtres commencent sous la barre : sa hauteur est publiée dans --dev-bar-h (common.module.css).
  const el = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--dev-bar-h", `${node.getBoundingClientRect().height + 8}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(node);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--dev-bar-h");
    };
  }, []);
  return (
    <div ref={el} className={styles.devBar} role="toolbar" aria-label="Mode développeur">
      <strong className={styles.devTitle}>DEV</strong>
      {catalog.resources.map((r) => {
        const minus: ManualOp = { kind: "resource", resource: r, delta: -1 };
        const plus: ManualOp = { kind: "resource", resource: r, delta: 1 };
        return (
          <span key={r} className={styles.devRes}>
            <button className={styles.devBtn} disabled={!ok(minus)} onClick={() => onAction(manual(minus))} aria-label={`Retirer 1 ${r}`}>
              −
            </button>
            <Icon id={r} /> {state.resources[r] ?? 0}
            <button className={styles.devBtn} disabled={!ok(plus)} onClick={() => onAction(manual(plus))} aria-label={`Ajouter 1 ${r}`}>
              +
            </button>
          </span>
        );
      })}
      <button className={styles.devBtn} onClick={onShowDeck}>
        Pioche ({state.zones.deck.length})
      </button>
      <button className={styles.devBtn} onClick={onShowBox}>
        Boîte ({state.zones.box.filter((id) => instance(state, id).serial > 0).length})
      </button>
      {ok({ kind: "skip" }) && (
        <button className={`${styles.devBtn} ${styles.devBtnWarn}`} onClick={() => onAction(manual({ kind: "skip" }))}>
          Passer la question
        </button>
      )}
      <span className={styles.devHint}>Toucher une carte : la modifier</span>
    </div>
  );
}
