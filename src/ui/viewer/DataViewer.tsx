import { useEffect, useMemo, useState } from "react";
import { availableExpansions, cardImageUrl, loadExpansion, type LoadedCard } from "../../data/loadCards";
import { ORIENTATION_KEYS, STAGE_IDS, type CardTemplate, type Stage } from "../../data/schema";
import styles from "./DataViewer.module.css";

// Visionneuse de données (spec section 9) : image à côté des données extraites, pour vérifier l'extraction.

type Filter = "all" | "toVerify" | "invalid" | "noDsl";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "toVerify", label: "À vérifier" },
  { id: "invalid", label: "Invalides" },
  { id: "noDsl", label: "Effets sans DSL" },
];

// Les textes d'aide du site contiennent du HTML (<b>, <br>) : affichés en texte brut.
function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function stagesOf(card: CardTemplate): Stage[] {
  return STAGE_IDS.flatMap((id) => card.stages[String(id) as keyof CardTemplate["stages"]] ?? []);
}

function cardLabel(c: LoadedCard): string {
  if (!c.result.ok) return "(fiche invalide)";
  return stagesOf(c.result.card)
    .map((s) => s.name)
    .filter((n) => n !== "")
    .join(" · ");
}

function matches(c: LoadedCard, filter: Filter, search: string): boolean {
  const r = c.result;
  if (filter === "invalid" && r.issues.length === 0) return false;
  if (filter === "toVerify" && !(r.ok && r.card.to_verify.length > 0)) return false;
  if (filter === "noDsl" && !(r.ok && stagesOf(r.card).some((s) => s.effects.some((e) => e.dsl === undefined)))) {
    return false;
  }
  const q = search.trim().toLowerCase();
  return q === "" || String(c.serial) === q || cardLabel(c).toLowerCase().includes(q);
}

function Icons({ ids }: { ids: readonly string[] }) {
  return <span className={styles.icons}>{ids.map((id) => `{${id}}`).join(" ")}</span>;
}

function StageView({ stage }: { stage: Stage }) {
  const flags = [
    stage.permanent && "permanente",
    stage.staysInPlay && "stays in play",
    stage.negative && "négative",
    stage.cannotBeDestroyed && "indestructible",
    stage.cannotBePurged && "non purgeable",
    stage.equip && `équipement (${stage.equip.keyword})`,
  ].filter((f): f is string => typeof f === "string");
  return (
    <section className={styles.stage}>
      <h3>
        <span className={styles.banner} style={{ background: `var(--cat-${stage.category})` }} />
        Stage {stage.id} : {stage.name === "" ? <em>(sans nom)</em> : stage.name}
      </h3>
      <dl>
        <dt>Mots-clés</dt>
        <dd>{stage.keywords.join(", ") || "aucun"} ({stage.category})</dd>
        <dt>Gloire</dt>
        <dd>
          {stage.fame}
          {stage.fameVariable && " + variable (voir le texte)"}
        </dd>
        <dt>Production</dt>
        <dd>
          {stage.production.length === 0
            ? "aucune"
            : stage.production.map((g) => (
                <div key={g.id}>
                  {g.options.map((o, i) => (
                    <span key={i}>
                      {i > 0 && " / "}
                      <Icons ids={o} />
                    </span>
                  ))}
                </div>
              ))}
        </dd>
        <dt>Améliorations</dt>
        <dd>
          {stage.upgrades.length === 0
            ? "aucune"
            : stage.upgrades.map((u) => (
                <div key={u.id}>
                  <Icons ids={u.cost} /> {u.otherCost} → {u.arrow === "rotate" ? "rotation" : "retournement"} vers
                  le stage {u.toStage}
                </div>
              ))}
        </dd>
        <dt>Effets</dt>
        <dd>
          {stage.effects.length === 0
            ? "aucun"
            : stage.effects.map((e) => (
                <div key={e.id}>
                  <b>
                    {e.type}
                    {e.oneTime && " (usage unique)"}
                  </b>{" "}
                  : {e.text} {e.dsl === undefined && <span className={styles.todo}>sans DSL</span>}
                </div>
              ))}
        </dd>
        {stage.checkboxes.length > 0 && (
          <>
            <dt>Cases</dt>
            <dd>
              {stage.checkboxes.length} cases
              <ol className={styles.boxes}>
                {stage.checkboxes.map((c) => (
                  <li key={c.id}>
                    {[
                      c.threshold !== undefined && `seuil ${c.threshold}`,
                      c.cost && `coût ${c.cost.length} {${c.cost[0] ?? ""}}`,
                      c.gain && `gain ${c.gain.map((g) => `{${g}}`).join(" ")}`,
                      c.fame !== undefined && `gloire ${c.fame}`,
                      c.icon && `{${c.icon}}`,
                      c.text,
                    ]
                      .filter((x): x is string => typeof x === "string")
                      .join(" · ") || "vide"}
                  </li>
                ))}
              </ol>
            </dd>
          </>
        )}
        {stage.defeat && (
          <>
            <dt>Défaite</dt>
            <dd>
              {stage.defeat.kind} {stage.defeat.text}
            </dd>
          </>
        )}
        {flags.length > 0 && (
          <>
            <dt>Marqueurs</dt>
            <dd>{flags.join(", ")}</dd>
          </>
        )}
        <dt>Texte imprimé</dt>
        <dd>{stage.text === "" ? "aucun" : stage.text}</dd>
        {stage.flavor && (
          <>
            <dt>Ambiance</dt>
            <dd>
              <em>{stage.flavor}</em>
            </dd>
          </>
        )}
        {stage.siteKeywords.length > 0 && (
          <>
            <dt>Glossaire du site</dt>
            <dd>{stage.siteKeywords.join(", ")}</dd>
          </>
        )}
        {stage.helpText && (
          <>
            <dt>Aide du site</dt>
            <dd className={styles.help}>{plainText(stage.helpText)}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function CardImage({ path, label }: { path: string; label: string }) {
  const url = cardImageUrl(path);
  return (
    <figure className={styles.figure}>
      {url ? (
        <img src={url} alt={label} loading="lazy" />
      ) : (
        <div className={styles.missing}>Image absente : lancer « npm run images »</div>
      )}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function CardDetail({ loaded }: { loaded: LoadedCard }) {
  const { result } = loaded;
  return (
    <article className={styles.detail}>
      <h2>
        #{loaded.serial} {cardLabel(loaded)}
      </h2>
      {result.issues.length > 0 && (
        <ul className={styles.issues}>
          {result.issues.map((i, n) => (
            <li key={n}>
              <code>{i.path}</code> : {i.message}
            </li>
          ))}
        </ul>
      )}
      {result.ok && (
        <>
          {result.card.to_verify.length > 0 && (
            <ul className={styles.toVerify}>
              {result.card.to_verify.map((t, n) => (
                <li key={n}>{t}</li>
              ))}
            </ul>
          )}
          <p className={styles.meta}>
            Confiance {Math.round(result.card.confidence * 100)} % ·{" "}
            {[
              result.card.isParchment && "parchemin",
              result.card.chooseSideOnDiscover && "face au choix à la découverte",
              result.card.isFinalRoundMarker && "lance la dernière manche",
            ]
              .filter((f): f is string => typeof f === "string")
              .join(" · ") || "carte standard"}{" "}
            · {ORIENTATION_KEYS.map((k) => `${k} → ${result.card.orientationToStage[k] ?? "rien"}`).join(", ")} ·{" "}
            <a href={result.card.source.url} target="_blank" rel="noreferrer">
              page du site
            </a>
          </p>
          <div className={styles.columns}>
            <div className={styles.images}>
              <CardImage path={result.card.images.front} label="Recto (stages 1 et 2)" />
              <CardImage path={result.card.images.back} label="Verso (stages 4 et 3)" />
            </div>
            <div className={styles.stages}>
              {stagesOf(result.card).map((s) => (
                <StageView key={s.id} stage={s} />
              ))}
            </div>
          </div>
          {result.card.description && <p className={styles.help}>{plainText(result.card.description)}</p>}
        </>
      )}
    </article>
  );
}

export function DataViewer() {
  const expansionIds = useMemo(() => availableExpansions(), []);
  const [expansion, setExpansion] = useState(expansionIds[0] ?? "");
  const [cards, setCards] = useState<LoadedCard[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadExpansion(expansion).then((loaded) => {
      if (!cancelled) setCards(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [expansion]);

  const visible = cards.filter((c) => matches(c, filter, search));
  const current = visible.find((c) => c.file === selected) ?? visible[0];
  const invalid = cards.filter((c) => c.result.issues.length > 0).length;
  const toVerify = cards.filter((c) => c.result.ok && c.result.card.to_verify.length > 0).length;

  return (
    <div className={styles.viewer}>
      <aside className={styles.sidebar}>
        <h1>
          <a href="#/" aria-label="Retour aux royaumes">←</a> Visionneuse de données
        </h1>
        <select value={expansion} onChange={(e) => setExpansion(e.target.value)} aria-label="Extension">
          {expansionIds.map((id) => (
            <option key={id}>{id}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Numéro ou nom"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher une carte"
        />
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <p className={styles.meta}>
          {cards.length} fiches · {toVerify} à vérifier · {invalid} invalides
        </p>
        <ul className={styles.list}>
          {visible.map((c) => (
            <li key={c.file}>
              <button aria-current={c === current} onClick={() => setSelected(c.file)}>
                <span className={styles.serial}>#{c.serial}</span> {cardLabel(c)}
                {c.result.issues.length > 0 && <span className={styles.badgeDanger}>invalide</span>}
                {c.result.ok && c.result.card.to_verify.length > 0 && <span className={styles.badgeWarn}>?</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className={styles.main}>
        {current ? <CardDetail loaded={current} /> : <p>Aucune carte ne correspond.</p>}
      </main>
    </div>
  );
}
