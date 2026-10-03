import { useEffect, useState, type ReactNode } from "react";
import styles from "./common.module.css";

// Fenêtre modale simple : fond cliquable et Échap pour fermer (quand c'est permis).

type Props = {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  actions?: ReactNode;
  wide?: boolean;
  /** Au-dessus des autres fenêtres (signalement d'un bug ouvert pendant une décision). */
  top?: boolean;
};

export function Dialog({ title, children, onClose, actions, wide, top }: Props) {
  // « Voir le jeu » : la fenêtre se cache sans se fermer (la décision reste en attente), « Revoir » la rouvre.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={`${styles.backdrop} ${top ? styles.topLayer : ""} ${hidden ? styles.backdropHidden : ""}`} onClick={hidden ? undefined : onClose}>
      {hidden && (
        <button className={styles.peekBack} onClick={() => setHidden(false)}>
          Revoir « {title} »
        </button>
      )}
      <div
        className={`${styles.dialog} ${wide ? styles.wide : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2>{title}</h2>
          <button className={styles.peek} onClick={() => setHidden(true)} aria-label="Cacher la fenêtre pour voir le jeu">
            Voir le jeu
          </button>
          {onClose && (
            <button className={styles.close} onClick={onClose} aria-label="Fermer">
              ✕
            </button>
          )}
        </header>
        <div className={styles.dialogBody}>{children}</div>
        {actions && <footer className={styles.dialogActions}>{actions}</footer>}
      </div>
    </div>
  );
}
