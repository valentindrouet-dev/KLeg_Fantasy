import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  activeStage,
  cardName,
  describeAction,
  upgradeOptions,
  usableEffects,
  type Action,
  type Catalog,
  type GameState,
  type InstanceId,
} from "../../engine";
import { IconText } from "../common/IconText";
import styles from "./Game.module.css";

// Feuille d'actions d'une carte en jeu (spec 7.5) : popover ancré à la carte, actions légales seulement,
// et raison affichée pour ce qui est impossible.

type Props = {
  catalog: Catalog;
  state: GameState;
  card: InstanceId;
  anchor: DOMRect;
  legal: Action[];
  onAction: (a: Action) => void;
  onInspect: () => void;
  onClose: () => void;
};

const ACTION_EFFECT_TYPES = ["activated", "destroy", "time"];

export function CardActions({ catalog, state, card, anchor, legal, onAction, onInspect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: anchor.bottom + 8, left: anchor.left });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    let top = anchor.bottom + margin;
    if (top + height > window.innerHeight - margin) top = Math.max(margin, anchor.top - height - margin);
    const left = Math.min(Math.max(margin, anchor.left + anchor.width / 2 - width / 2), window.innerWidth - width - margin);
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mine = legal.filter((a) => "card" in a && a.card === card);
  const produce = mine.filter((a) => a.type === "produce");
  const upgrades = mine.filter((a) => a.type === "upgrade");
  const effects = mine.filter((a) => a.type === "useEffect");
  const blockedUpgrades = upgradeOptions(catalog, state, card).filter((o) => o.reason !== null);
  const stage = activeStage(catalog, state, card);
  const automated = new Set(usableEffects(catalog, state, card).map((e) => e.effect.id));
  const effectNotes = (stage?.effects ?? []).flatMap((e) => {
    if (!ACTION_EFFECT_TYPES.includes(e.type)) return [];
    if (!automated.has(e.id)) return [{ id: e.id, text: e.text, why: "Pas encore automatisé (phase P3)" }];
    if (!effects.some((a) => a.type === "useEffect" && a.effect === e.id)) return [{ id: e.id, text: e.text, why: "Conditions non remplies" }];
    return [];
  });

  const button = (a: Action, i: number) => (
    <button key={i} className={styles.actionItem} onClick={() => onAction(a)}>
      <IconText text={describeAction(catalog, state, a)} />
    </button>
  );

  return (
    <>
      <div className={styles.popoverBackdrop} onClick={onClose} />
      <div ref={ref} className={styles.popover} style={pos} role="menu" aria-label={`Actions : ${cardName(catalog, state, card)}`}>
        <h3>{cardName(catalog, state, card)}</h3>
        {produce.length > 0 && <section>{produce.map(button)}</section>}
        {(upgrades.length > 0 || blockedUpgrades.length > 0) && (
          <section>
            {upgrades.map(button)}
            {blockedUpgrades.map((o) => (
              <div key={o.upgrade.id} className={styles.actionDisabled}>
                <IconText text={`Améliorer : ${o.upgrade.cost.map((r) => `{${r}}`).join("") || "gratuit"}${o.upgrade.otherCost ? ` + ${o.upgrade.otherCost}` : ""}`} />
                <small>
                  <IconText text={o.reason ?? ""} />
                </small>
              </div>
            ))}
          </section>
        )}
        {(effects.length > 0 || effectNotes.length > 0) && (
          <section>
            {effects.map(button)}
            {effectNotes.map((n) => (
              <div key={n.id} className={styles.actionDisabled}>
                <IconText text={n.text} />
                <small>{n.why}</small>
              </div>
            ))}
          </section>
        )}
        {mine.length === 0 && blockedUpgrades.length === 0 && effectNotes.length === 0 && (
          <p className={styles.muted}>Aucune action possible avec cette carte.</p>
        )}
        <section>
          <button className={styles.actionItem} onClick={onInspect}>
            🔍 Inspecter les 4 stages
          </button>
        </section>
      </div>
    </>
  );
}
