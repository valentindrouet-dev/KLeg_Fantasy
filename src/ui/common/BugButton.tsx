import { useEffect, useState } from "react";
import { addBug, bugsFileName, deleteBug, exportBugs, listBugs, newBugId, type BugReport } from "../../persistence/bugs";
import { APP_VERSION } from "../../version";
import { Dialog } from "./Dialog";
import { downloadText } from "./download";
import { BugIcon } from "./UiIcons";
import styles from "./common.module.css";

// Bouton « bug » de la barre du haut (demande du 2026-10-03) : on décrit le problème, il est enregistré avec la
// partie en cours (rejouable) et l'état de l'écran ; les bugs enregistrés se partagent ensuite en un fichier.

type Props = {
  className?: string;
  /** Partie en cours au moment du signalement (absent hors partie). */
  game?: () => BugReport["game"];
};

export function BugButton({ className, game }: Props) {
  const [open, setOpen] = useState(false);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const refresh = () => void listBugs().then(setBugs);
  useEffect(refresh, []);
  return (
    <>
      <button
        className={`${className ?? ""} ${styles.bugBtn}`}
        onClick={() => setOpen(true)}
        aria-label="Signaler un bug"
        title="Signaler un bug"
      >
        <BugIcon />
        {bugs.length > 0 && <span className={styles.bugCount}>{bugs.length}</span>}
      </button>
      {open && (
        <BugDialog
          bugs={bugs}
          game={game}
          onChange={refresh}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function BugDialog({ bugs, game, onChange, onClose }: { bugs: BugReport[]; game: Props["game"]; onChange: () => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  // L'écran est figé à l'ouverture : c'est lui que le bug décrit, pas ce qui suit.
  const [snapshot] = useState(() => game?.());

  const save = async () => {
    const bug: BugReport = {
      id: newBugId(),
      createdAt: Date.now(),
      text: text.trim(),
      appVersion: APP_VERSION,
      device: { screen: `${window.innerWidth} × ${window.innerHeight}`, userAgent: navigator.userAgent, route: window.location.hash },
      ...(snapshot ? { game: snapshot } : {}),
    };
    await addBug(bug);
    onChange();
    onClose();
  };

  const file = () => exportBugs(bugs, APP_VERSION);

  const share = async () => {
    const f = new File([file()], bugsFileName(), { type: "application/json" });
    try {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: "Bugs Kingdom Legacy" });
        return;
      }
    } catch (err) {
      // Partage annulé par l'utilisateur : rien à faire.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    downloadText(f.name, file());
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      downloadText(bugsFileName(), file());
    }
  };

  return (
    <Dialog
      title="Signaler un bug"
      top
      onClose={onClose}
      actions={
        <>
          {bugs.length > 0 && (
            <>
              <button className="btn" onClick={() => void share()}>
                Partager ({bugs.length})
              </button>
              <button className="btn" onClick={() => void copy()}>
                {copied ? "Copié" : "Copier"}
              </button>
            </>
          )}
          <button className="btn btn-primary" disabled={text.trim() === ""} onClick={() => void save()}>
            Enregistrer
          </button>
        </>
      }
    >
      <textarea
        className={styles.bugText}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ce qui ne marche pas, et ce que tu attendais"
        autoFocus
      />
      {bugs.length > 0 && (
        <ul className={styles.bugList}>
          {[...bugs].reverse().map((b) => (
            <li key={b.id}>
              <span>
                <small>{new Date(b.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</small> {b.text}
              </span>
              <button
                className={styles.close}
                aria-label="Supprimer ce bug"
                onClick={() => void deleteBug(b.id).then(onChange)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
