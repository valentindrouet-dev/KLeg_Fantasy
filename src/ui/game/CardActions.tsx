import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { activeStage, cardName, type Action, type Catalog, type GameState, type InstanceId } from "../../engine";
import { stageFr } from "../../data/translations";
import { IconText } from "../common/IconText";
import styles from "./Game.module.css";

// Feuille d'actions d'une carte en jeu (spec 7.5) : popover ancré à la carte.
// Engager / libérer la ressource, améliorations et effets (payables avec les cartes engagées),
// raisons d'impossibilité, traduction française du stage actif.

export type CardOption = { action: Action; plan: Action[] | null; label: string; reason: string | null };

type Props = {
  catalog: Catalog;
  state: GameState;
  card: InstanceId;
  anchor: DOMRect;
  options: CardOption[];
  engageLabel: string | null; // null : la carte ne produit rien
  engaged: boolean;
  onEngage: () => void;
  onRun: (o: CardOption) => void;
  onInspect: () => void;
  onClose: () => void;
};

export function CardActions({ catalog, state, card, anchor, options, engageLabel, engaged, onEngage, onRun, onInspect, onClose }: Props) {
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

  const stage = activeStage(catalog, state, card);
  const fr = stage ? stageFr(state.cards[card]?.templateId ?? "", stage.id) : undefined;

  return (
    <>
      <div className={styles.popoverBackdrop} onClick={onClose} />
      <div ref={ref} className={styles.popover} style={pos} role="menu" aria-label={`Actions : ${cardName(catalog, state, card)}`}>
        <h3>{cardName(catalog, state, card)}</h3>
        {fr && (fr.text || fr.name !== stage?.name) && (
          <p className={styles.translation}>
            <strong>{fr.name}</strong> {fr.text && <IconText text={fr.text} />}
          </p>
        )}
        {engageLabel && (
          <section>
            <button className={styles.actionItem} onClick={onEngage}>
              <IconText text={engaged ? `Libérer ${engageLabel}` : `Engager ${engageLabel}`} />
            </button>
          </section>
        )}
        {options.length > 0 && (
          <section>
            {options.map((o, i) =>
              o.plan ? (
                <button key={i} className={styles.actionItem} onClick={() => onRun(o)}>
                  <IconText text={o.label} />
                </button>
              ) : (
                <div key={i} className={styles.actionDisabled}>
                  <IconText text={o.label} />
                  <small>
                    <IconText text={o.reason ?? "Impossible pour l'instant"} />
                  </small>
                </div>
              ),
            )}
          </section>
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
