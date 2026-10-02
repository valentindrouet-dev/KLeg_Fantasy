import { useCallback, useEffect, useState } from "react";
import { canRestartKingdom, current, newSession, randomSeed, type Catalog, type UndoMode } from "../../engine";
import { deleteKingdom, duplicateKingdom, listKingdoms, renameKingdom, saveKingdom } from "../../persistence/db";
import { KINGDOM_EMOJIS, newKingdomId, randomKingdomName, summarize, type Kingdom } from "../../persistence/kingdoms";
import { Dialog } from "../common/Dialog";
import { IconText } from "../common/IconText";
import { APP_VERSION } from "../../version";
import { CardsIcon, CopyIcon, EditIcon, ImportIcon, PlayIcon, PlusIcon, RestartIcon, TrashIcon } from "../common/UiIcons";
import { importKingdom } from "../../persistence/backup";
import styles from "./Kingdoms.module.css";

// Écran « Mes royaumes » (spec 6.1) : premier écran de l'appli.

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function createKingdom(catalog: Catalog, name: string, emoji: string, undoMode: UndoMode, seed: number): Kingdom {
  const session = newSession(catalog, { expansion: "FeudalKingdom", seed, undoMode });
  const state = current(session);
  const now = Date.now();
  return { id: newKingdomId(), name, emoji, createdAt: now, updatedAt: now, summary: summarize(catalog, session.record, state), record: session.record, state };
}

function NewKingdomDialog({ catalog, onClose }: { catalog: Catalog; onClose: () => void }) {
  const [name, setName] = useState(() => randomKingdomName());
  const [emoji, setEmoji] = useState(KINGDOM_EMOJIS[0] ?? "🏰");
  const [undoMode, setUndoMode] = useState<UndoMode>("strict");
  const [seedText, setSeedText] = useState("");
  const seed = seedText.trim() === "" ? null : Number.parseInt(seedText, 10);
  const valid = name.trim() !== "" && (seed === null || Number.isFinite(seed));

  const create = async () => {
    const k = createKingdom(catalog, name.trim(), emoji, undoMode, seed ?? randomSeed());
    await saveKingdom(k);
    window.location.hash = `#/partie/${k.id}`;
  };

  return (
    <Dialog
      title="Nouveau royaume"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" disabled={!valid} onClick={() => void create()}>
            Fonder le royaume
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <label>
          Nom
          <span className={styles.inline}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            <button className="btn" onClick={() => setName(randomKingdomName())} aria-label="Autre nom au hasard">
              🎲
            </button>
          </span>
        </label>
        <fieldset>
          <legend>Blason</legend>
          <div className={styles.emojis}>
            {KINGDOM_EMOJIS.map((e) => (
              <button key={e} className={styles.emoji} aria-pressed={e === emoji} onClick={() => setEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Annulation</legend>
          <label className={styles.radio}>
            <input type="radio" checked={undoMode === "strict"} onChange={() => setUndoMode("strict")} />
            <span>Stricte</span>
          </label>
          <label className={styles.radio}>
            <input type="radio" checked={undoMode === "free"} onChange={() => setUndoMode("free")} />
            <span>Libre</span>
          </label>
        </fieldset>
        <label>
          Graine
          <input inputMode="numeric" placeholder="aléatoire" value={seedText} onChange={(e) => setSeedText(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
    </Dialog>
  );
}

function RenameDialog({ kingdom, onDone }: { kingdom: Kingdom; onDone: () => void }) {
  const [name, setName] = useState(kingdom.name);
  const [emoji, setEmoji] = useState(kingdom.emoji);
  return (
    <Dialog
      title="Renommer le royaume"
      onClose={onDone}
      actions={
        <button
          className="btn btn-primary"
          disabled={name.trim() === ""}
          onClick={() => void renameKingdom(kingdom.id, name.trim(), emoji).then(onDone)}
        >
          Enregistrer
        </button>
      }
    >
      <div className={styles.form}>
        <label>
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <div className={styles.emojis}>
          {KINGDOM_EMOJIS.map((e) => (
            <button key={e} className={styles.emoji} aria-pressed={e === emoji} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

type Menu = { kind: "rename" | "delete" | "restart"; kingdom: Kingdom };

export function KingdomsScreen({ catalog }: { catalog: Catalog }) {
  const [kingdoms, setKingdoms] = useState<Kingdom[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [search, setSearch] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const refresh = useCallback(() => void listKingdoms().then(setKingdoms), []);
  useEffect(refresh, [refresh]);

  const shown = (kingdoms ?? []).filter((k) => k.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1>Mes royaumes</h1>
        {(kingdoms?.length ?? 0) > 6 && (
          <input className={styles.search} placeholder="Rechercher" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
        <label className={styles.tool} aria-label="Importer une sauvegarde" title="Importer une sauvegarde">
          <ImportIcon />
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void file.text().then(async (text) => {
                try {
                  const k = importKingdom(catalog, text, (kingdoms ?? []).map((x) => x.id));
                  await saveKingdom(k);
                  refresh();
                } catch (err) {
                  setImportError(err instanceof Error ? err.message : "Import impossible.");
                }
              });
            }}
          />
        </label>
        <a className={styles.tool} href="#/cartes" aria-label="Visionneuse des cartes" title="Visionneuse des cartes">
          <CardsIcon />
        </a>
        <button className={styles.play} onClick={() => setCreating(true)}>
          <PlusIcon /> Nouveau royaume
        </button>
      </header>

      {kingdoms === null ? (
        <p className={styles.empty}>Chargement…</p>
      ) : kingdoms.length === 0 ? (
        <div className={styles.empty}>
          <p>Aucun royaume pour l'instant.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Fonder mon premier royaume
          </button>
        </div>
      ) : (
        <ul className={styles.grid}>
          {shown.map((k) => (
            <li key={k.id} className={styles.kingdom}>
              <a className={styles.main} href={`#/partie/${k.id}`}>
                <span className={styles.crest}>{k.emoji}</span>
                <span className={styles.name}>{k.name}</span>
                <span className={styles.status} data-status={k.summary.status}>
                  {k.summary.status === "finished" ? "Terminé" : "En cours"}
                </span>
                <span className={styles.stats}>
                  Manche {k.summary.round} · <IconText text={`{fame} ${k.summary.fame}`} />
                  {k.summary.lastDiscovered !== null && ` · dernière carte #${k.summary.lastDiscovered}`}
                </span>
                <span className={styles.date}>Joué le {dateFormat.format(k.updatedAt)}</span>
              </a>
              <div className={styles.actions}>
                <a className={styles.play} href={`#/partie/${k.id}`}>
                  <PlayIcon /> {k.summary.status === "finished" ? "Consulter" : "Continuer"}
                </a>
                <button className={styles.tool} onClick={() => setMenu({ kind: "rename", kingdom: k })} aria-label="Renommer" title="Renommer">
                  <EditIcon />
                </button>
                <button className={styles.tool} onClick={() => void duplicateKingdom(k.id).then(refresh)} aria-label="Dupliquer" title="Dupliquer">
                  <CopyIcon />
                </button>
                {canRestartKingdom(k.state) && (
                  <button className={styles.tool} onClick={() => setMenu({ kind: "restart", kingdom: k })} aria-label="Recommencer" title="Recommencer">
                    <RestartIcon />
                  </button>
                )}
                <button className={`${styles.tool} ${styles.danger}`} onClick={() => setMenu({ kind: "delete", kingdom: k })} aria-label="Supprimer" title="Supprimer">
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className={styles.footer}>
        Kingdom Legacy Digital {APP_VERSION} ·{" "}
        <a href="https://github.com/valentindrouet-dev/KLeg_Fantasy/blob/claude/sharp-curie-b9evuk/CHANGELOG.md" target="_blank" rel="noreferrer">
          nouveautés
        </a>
      </footer>

      {importError && (
        <Dialog title="Import impossible" onClose={() => setImportError(null)}>
          <p>{importError}</p>
        </Dialog>
      )}
      {creating && <NewKingdomDialog catalog={catalog} onClose={() => setCreating(false)} />}
      {menu?.kind === "rename" && (
        <RenameDialog
          kingdom={menu.kingdom}
          onDone={() => {
            setMenu(null);
            refresh();
          }}
        />
      )}
      {menu?.kind === "delete" && (
        <Dialog
          title="Supprimer le royaume ?"
          onClose={() => setMenu(null)}
          actions={
            <>
              <button className="btn" onClick={() => setMenu(null)}>
                Garder
              </button>
              <button
                className="btn btn-danger"
                onClick={() =>
                  void deleteKingdom(menu.kingdom.id).then(() => {
                    setMenu(null);
                    refresh();
                  })
                }
              >
                Supprimer définitivement
              </button>
            </>
          }
        >
          <p>
            {menu.kingdom.emoji} <strong>{menu.kingdom.name}</strong>
          </p>
        </Dialog>
      )}
      {menu?.kind === "restart" && (
        <Dialog
          title="Recommencer le royaume ?"
          onClose={() => setMenu(null)}
          actions={
            <>
              <button className="btn" onClick={() => setMenu(null)}>
                Annuler
              </button>
              {[
                { label: "Même graine", seed: menu.kingdom.record.config.seed },
                { label: "Nouvelle graine", seed: randomSeed() },
              ].map(({ label, seed }) => (
                <button
                  key={label}
                  className="btn btn-primary"
                  onClick={() => {
                    const k = menu.kingdom;
                    const fresh = createKingdom(catalog, k.name, k.emoji, k.record.config.undoMode, seed);
                    void saveKingdom({ ...fresh, id: k.id, createdAt: k.createdAt }).then(() => {
                      setMenu(null);
                      refresh();
                    });
                  }}
                >
                  {label}
                </button>
              ))}
            </>
          }
        >
          <p>
            {menu.kingdom.emoji} <strong>{menu.kingdom.name}</strong> · graine {menu.kingdom.record.config.seed}
          </p>
        </Dialog>
      )}
    </div>
  );
}
