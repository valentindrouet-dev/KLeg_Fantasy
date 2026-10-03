import { useEffect, type ReactNode } from "react";
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
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={`${styles.backdrop} ${top ? styles.topLayer : ""}`} onClick={onClose}>
      <div
        className={`${styles.dialog} ${wide ? styles.wide : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2>{title}</h2>
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
