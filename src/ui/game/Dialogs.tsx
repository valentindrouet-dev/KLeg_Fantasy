import { Fragment, useEffect, useState, type ReactNode } from "react";
import { isValidAnswer, canBeNamed,
  availableExpansions,
  availableGrandExpansions,
  grandExpansions,
  GRAND_EXPANSIONS,
  boxViews,
  canRestartKingdom,
  EXPANSION_SERIALS,
  exhaustedEffects,
  expansionName,
  activeStage,
  cardName,
  computeScore,
  instance,
  kingdomStats,
  template,
  type Action,
  type Answer,
  type Catalog,
  type GameState,
  type InstanceId,
} from "../../engine";
import type { CardTemplate, Side, StageId } from "../../data/schema";
import { Dialog } from "../common/Dialog";
import { Icon, IconText, StickerLegend } from "../common/IconText";
import { stickersIn } from "../common/stickerText";
import { CardView, type CardNote } from "./CardView";
import { frNote } from "./translationNote";
import { goalView, stageAtPoint } from "./goals";
import { referencedSerials } from "./cardRefs";
import { DevCardTools } from "./DevTools";
import { useGame } from "./store";

/** Objectifs du royaume en cours et bascule (appui long sur une moitié de carte). */
function useGoals() {
  const goals = useGame((g) => g.kingdom?.goals ?? NO_GOALS);
  const toggleGoal = useGame((g) => g.toggleGoal);
  return { goals, toggleGoal };
}
const NO_GOALS: never[] = [];
import { usePrefs } from "../common/prefs";
import type { TapPoint } from "../common/usePress";
import styles from "./Game.module.css";

// Fenêtres de la partie : inspection, décisions en attente, défausse, fin de partie, confirmation.

/** Effets épuisés d'une carte, à barrer partout où elle est dessinée. */
const exhaustedOf = (catalog: Catalog, state: GameState, id: InstanceId) => (stage: StageId) => exhaustedEffects(catalog, state, id, stage);

/** Largeur des cartes d'une liste (défausse) : environ 5 par rangée. */
function listCard(): number {
  return Math.floor(Math.max(180, Math.min(300, (Math.min(window.innerWidth, 1500) - 140) / 5)));
}

/** Largeur d'une carte d'un choix de découverte à 2 cartes (recto + verso) par rangée, 2 rangées visibles. */
function pairWidth(): number {
  const byWidth = (Math.min(window.innerWidth, 1500) - 140 - 3 * 16) / 4;
  const byHeight = ((window.innerHeight - 300) / 2) * (373 / 520);
  return Math.floor(Math.max(130, Math.min(320, byWidth, byHeight)));
}

/** Hauteur de la barre du mode développeur (0 sans elle), qui repousse le haut des fenêtres. */
function devBarHeight(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dev-bar-h")) || 0;
}

/**
 * Largeur des cartes empilées en rangées (recto + verso par rangée) : toutes les rangées tiennent sans défiler, en
 * largeur comme en hauteur (iPad en portrait, demande du 2026-10-05). `below` : hauteur sous chaque rangée (libellés,
 * légende des stickers). Marges mesurées : haut des fenêtres 74 px, en-tête et pied 140, corps 32, bas 16.
 */
function stackedWidth(rows: number, below: number): number {
  const n = Math.max(1, rows);
  const free = window.innerHeight - devBarHeight() - 74 - 140 - 32 - 24 - (n - 1) * 16 - n * below;
  const byHeight = (free / n) * (373 / 520);
  const byWidth = (Math.min(document.documentElement.clientWidth, 1500) - 32 - 2 - 32 - 8) / 2;
  return Math.floor(Math.max(110, Math.min(420, byHeight, byWidth)));
}

/** Textes imprimés de toutes les étapes d'une carte (pour la légende des stickers cités). */
const stageTexts = (t: CardTemplate): string[] => Object.values(t.stages).map((st) => st?.text ?? "");

/** Rendu à nouveau quand la fenêtre change de taille (rotation de l'iPad). */
function useViewport(): void {
  const [, set] = useState(0);
  useEffect(() => {
    const on = () => set((n) => n + 1);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
}

/** Largeur d'une grande carte dans une fenêtre : `count` cartes côte à côte, la plus grande qui tient. */
function bigCard(count = 1): number {
  const byHeight = (window.innerHeight - 200) * (373 / 520);
  const byWidth = (Math.min(window.innerWidth, 1500) - 120 - (count - 1) * 16) / count;
  return Math.floor(Math.max(150, Math.min(520, byHeight, byWidth)));
}

/**
 * Inspection : à gauche la carte telle qu'elle est posée, à droite l'autre face, même sens : stage 1 à côté du 4,
 * stage 2 à côté du 3, à l'envers (demande du 2026-10-02, qui remplace la rotation inversée).
 */
export function Inspector({
  catalog,
  state,
  card,
  onClose,
  onOpen,
  onBack,
  dev,
  onAction,
}: {
  catalog: Catalog;
  state: GameState;
  card: InstanceId;
  onClose: () => void;
  /** Ouvre l'inspection d'une carte citée par celle-ci. */
  onOpen?: (card: InstanceId) => void;
  /** Revient à la carte inspectée avant (après un renvoi). */
  onBack?: () => void;
  /** Mode développeur : gestes hors règles sur la carte (DevTools.tsx). */
  dev?: (a: Action) => void;
  /** Gestes libres de la partie depuis l'inspection (nommer Stranger). */
  onAction?: (a: Action) => void;
}) {
  const c = instance(state, card);
  const t = template(catalog, c.templateId);
  const other = { side: c.orientation.side === "front" ? "back" : "front", rotation: c.orientation.rotation } as const;
  // Mode FR : toucher une moitié pose sa traduction sur la carte ; toucher à nouveau l'enlève.
  const tooltipsFr = usePrefs((p) => p.tooltipsFr);
  const [note, setNote] = useState<{ face: 0 | 1; note: CardNote } | null>(null);
  const tap = (face: 0 | 1, o: typeof c.orientation) => (p: TapPoint) => {
    if (!tooltipsFr) return;
    const n = frNote(t, o, p.y < 0.5 ? "top" : "bottom");
    setNote(n && !(note?.face === face && note.note.half === n.half) ? { face, note: n } : null);
  };
  const refs = referencedSerials(t).flatMap((serial) => {
    const ref = Object.values(state.cards).find((x) => x.serial === serial && template(catalog, x.templateId).expansion === t.expansion);
    return ref ? [{ id: ref.instanceId, serial, name: template(catalog, ref.templateId).stages["1"]?.name ?? "" }] : [];
  });
  // Carte permanente dont on a choisi la face (objectifs…) : l'autre face ne servira plus, on ne la montre pas.
  const single = t.chooseSideOnDiscover && state.zones.permanent.includes(card);
  // Appui long sur une moitié : objectif doré (demande du 2026-10-04).
  const { goals, toggleGoal } = useGoals();
  const view = goalView(catalog, state, goals, card);
  const markGoal = (o: typeof c.orientation) => (p: TapPoint) => {
    const stage = stageAtPoint(t, o, p.y);
    if (stage !== null && stage !== activeStage(catalog, state, card)?.id) toggleGoal(card, stage);
  };
  return (
    <Dialog title={cardName(catalog, state, card)} onClose={onClose} wide>
      {dev && <DevCardTools catalog={catalog} state={state} card={card} onAction={dev} />}
      {(refs.length > 0 || onBack) && (
        // Cartes citées par le texte (« Discover Shrine (82 / 83) ») : consultables à tout moment (demande du 2026-10-05).
        <div className={styles.cardRefs}>
          {onBack && (
            <button className={styles.cardRef} onClick={onBack}>
              ← Retour
            </button>
          )}
          {refs.length > 0 && <span className={styles.muted}>Cartes citées :</span>}
          {refs.map((r) => (
            <button key={r.id} className={styles.cardRef} onClick={() => onOpen?.(r.id)} disabled={!onOpen}>
              #{r.serial} {r.name}
            </button>
          ))}
        </div>
      )}
      <StickerLegend texts={stageTexts(t)} className={styles.inspectorLegend} />
      {onAction && canBeNamed(catalog, state, card) && <NameField key={c.customName ?? ""} current={c.customName ?? ""} onName={(name) => onAction({ type: "manual", op: { kind: "name", card, name } })} />}
      <div className={styles.inspector}>
        <CardView
          markId={card}
          template={t}
          orientation={c.orientation}
          label="Face visible"
          width={bigCard(single ? 1 : 2)}
          stickers={c.stickers}
          onTap={tap(0, c.orientation)}
          onLongPress={markGoal(c.orientation)}
          goal={view}
          exhausted={(stage) => exhaustedEffects(catalog, state, card, stage)}
          boxes={(stage) => boxViews(catalog, state, card, stage)}
          note={tooltipsFr && note?.face === 0 ? note.note : undefined}
        />
        {!single && (
          <CardView
            markId={card}
            template={t}
            orientation={other}
            label="Autre face"
            width={bigCard(2)}
            stickers={c.stickers}
            onTap={tap(1, other)}
            onLongPress={markGoal(other)}
            goal={view && { stages: view.stages, arrows: [] }}
            exhausted={(stage) => exhaustedEffects(catalog, state, card, stage)}
          boxes={(stage) => boxViews(catalog, state, card, stage)}
            note={tooltipsFr && note?.face === 1 ? note.note : undefined}
          />
        )}
      </div>
    </Dialog>
  );
}

/** Stranger (#92) : « Give her/him a name! », un champ dans l'inspection, sans fenêtre (demande du 2026-10-05). */
function NameField({ current, onName }: { current: string; onName: (name: string) => void }) {
  const [value, setValue] = useState(current);
  const ok = value.trim().length >= 1 && value.trim().length <= 24 && value.trim() !== current;
  return (
    <form
      className={styles.nameField}
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onName(value);
      }}
    >
      <label>
        Son nom
        <input value={value} maxLength={24} placeholder="Donne-lui un nom" onChange={(e) => setValue(e.target.value)} />
      </label>
      <button className="btn btn-primary" type="submit" disabled={!ok}>
        {current ? "Renommer" : "Nommer"}
      </button>
    </form>
  );
}

export function DecisionDialog({
  catalog,
  state,
  onAction,
  onRestart,
  onInspect,
}: {
  catalog: Catalog;
  state: GameState;
  onAction: (a: Action) => void;
  onRestart: () => void;
  onInspect: (card: InstanceId) => void;
}) {
  const p = state.pending;
  if (!p) return null;
  const tOf = (id: InstanceId) => template(catalog, instance(state, id).templateId);

  if (p.kind === "parchment") {
    const t = tOf(p.card);
    // Carte 23 : on regarde les cartes 24 à 27, puis on recommence le royaume ou on continue.
    const resetPoint = t.serial === 23 && canRestartKingdom(state);
    const preview = resetPoint ? state.zones.box.filter((id) => [24, 25, 26, 27].includes(instance(state, id).serial)) : [];
    const width = bigCard(1 + preview.length);
    return (
      <Dialog
        title={`Parchemin #${t.serial}`}
        wide
        actions={
          <>
            {resetPoint && (
              <button className="btn" onClick={onRestart}>
                ↺ Recommencer le royaume
              </button>
            )}
            <button className="btn btn-primary" onClick={() => onAction({ type: "acknowledgeParchment" })}>
              Continuer
            </button>
          </>
        }
      >
        <div className={styles.decisionRow}>
          <CardView template={t} orientation={{ side: "front", rotation: 0 }} label={`Parchemin #${t.serial}`} width={width} />
          {preview.map((id) => (
            <CardView key={id} template={tOf(id)} orientation={{ side: "front", rotation: 0 }} label={`#${instance(state, id).serial}`} width={width} exhausted={exhaustedOf(catalog, state, id)}
              boxes={(stage) => boxViews(catalog, state, id, stage)} />
          ))}
          {!catalog.parchments.has(t.id) && <p className={styles.warning}>À appliquer à la main</p>}
        </div>
      </Dialog>
    );
  }

  if (p.kind === "chooseSide") {
    const t = tOf(p.card);
    return (
      <Dialog title={`Carte #${t.serial}`} wide>
        <div className={styles.decisionRow}>
          {(["front", "back"] as const).map((side) => (
            <figure key={side} className={styles.choice}>
              <CardView template={t} orientation={{ side, rotation: 0 }} label={side} width={bigCard(2)} onTap={() => onAction({ type: "chooseSide", side })} exhausted={exhaustedOf(catalog, state, p.card)}
              boxes={(stage) => boxViews(catalog, state, p.card, stage)} />
              <button className="btn btn-primary" onClick={() => onAction({ type: "chooseSide", side })}>
                {side === "front" ? "Recto" : "Verso"}
              </button>
            </figure>
          ))}
        </div>
      </Dialog>
    );
  }

  if (p.kind === "newCards") return <NewCardsDialog key={p.cards.join(",")} catalog={catalog} state={state} cards={p.cards} onAction={onAction} />;

  if (p.kind === "choice") return <ChoiceDialog key={`${p.source}/${p.script}/${p.answers.length}`} catalog={catalog} state={state} onAction={onAction} onInspect={onInspect} />;

  return (
    <Dialog title={`Découvrir ${p.remaining} carte${p.remaining > 1 ? "s" : ""}`} wide>
      <div className={`${styles.decisionRow} ${p.options.length > 2 ? styles.twoPerRow : ""}`}>
        {p.options.map((id) => {
          const t = tOf(id);
          const picked = p.picked.includes(id);
          // Plus de 2 cartes : 2 par rangée (recto + verso de chacune), rangées qui défilent (demande du 2026-10-02).
          const width = p.options.length > 2 ? pairWidth() : bigCard(p.options.length * 2);
          return (
            <figure key={id} className={styles.choice}>
              <div className={styles.bothSides}>
                <CardView markId={id} template={t} orientation={{ side: "front", rotation: 0 }} label="Recto" width={width} onLongPress={() => onInspect(id)} exhausted={exhaustedOf(catalog, state, id)}
              boxes={(stage) => boxViews(catalog, state, id, stage)} />
                <CardView markId={id} template={t} orientation={{ side: "back", rotation: 0 }} label="Verso" width={width} onLongPress={() => onInspect(id)} exhausted={exhaustedOf(catalog, state, id)}
              boxes={(stage) => boxViews(catalog, state, id, stage)} />
              </div>
              <button className="btn btn-primary" disabled={picked} onClick={() => onAction({ type: "chooseDiscovery", card: id })}>
                {picked ? "Choisie" : `#${t.serial}`}
              </button>
            </figure>
          );
        })}
      </div>
    </Dialog>
  );
}

export function CardListDialog({
  catalog,
  state,
  title,
  cards,
  onInspect,
  onClose,
}: {
  catalog: Catalog;
  state: GameState;
  title: string;
  cards: InstanceId[];
  onInspect: (id: InstanceId) => void;
  onClose: () => void;
}) {
  // Objectifs (contour doré) : visibles aussi dans la défausse (demande du 2026-10-04).
  const { goals } = useGoals();
  // Filtre par type (demande du 2026-10-04) : un bouton coloré par type présent ; le filtre tombe à la fermeture.
  const [only, setOnly] = useState<string | null>(null);
  const kinds = (id: InstanceId): readonly string[] => activeStage(catalog, state, id)?.keywords ?? [];
  const order = Object.keys(KEYWORD_TONES);
  const present = [...new Set(cards.flatMap(kinds))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b));
  const shown = only ? cards.filter((id) => kinds(id).includes(only)) : cards;
  const tools =
    present.length > 1 ? (
      <div className={styles.typeFilters} role="group" aria-label="Filtrer par type">
        {present.map((k) => {
          const tone = KEYWORD_TONES[k] ?? "var(--text-muted)";
          const on = only === k;
          return (
            <button
              key={k}
              className={styles.typeFilter}
              aria-pressed={on}
              onClick={() => setOnly(on ? null : k)}
              style={{ borderColor: tone, background: on ? tone : `color-mix(in srgb, ${tone} 18%, var(--surface))`, color: on ? "#fff" : undefined }}
            >
              {k} {cards.filter((id) => kinds(id).includes(k)).length}
            </button>
          );
        })}
      </div>
    ) : undefined;
  return (
    <Dialog title={`${title} (${only ? `${shown.length}/` : ""}${cards.length})`} onClose={onClose} wide tools={tools}>
      {shown.length === 0 ? (
        <p className={styles.muted}>Aucune carte.</p>
      ) : (
        <div className={styles.cardList}>
          {[...shown].reverse().map((id) => (
            <CardView
              key={id}
              markId={id}
              template={template(catalog, instance(state, id).templateId)}
              orientation={instance(state, id).orientation}
              label={cardName(catalog, state, id)}
              width={listCard()}
              onTap={() => onInspect(id)}
              onLongPress={() => onInspect(id)}
              exhausted={exhaustedOf(catalog, state, id)}
              boxes={(stage) => boxViews(catalog, state, id, stage)}
              stickers={instance(state, id).stickers}
              goal={goalView(catalog, state, goals, id)}
            />
          ))}
        </div>
      )}
    </Dialog>
  );
}

/** Question posée par un effet (spec 4.1) : cartes, ressources ou option. */
/**
 * Nouvelles cartes : recto et verso de chaque carte côte à côte, les cartes l'une au-dessus de l'autre. Carte à
 * flèches rouges : on touche la face à garder (recto par défaut), appliquée en validant (demande du 2026-10-04).
 */
function NewCardsDialog({
  catalog,
  state,
  cards,
  onAction,
}: {
  catalog: Catalog;
  state: GameState;
  cards: InstanceId[];
  onAction: (a: Action) => void;
}) {
  const [sides, setSides] = useState<Record<InstanceId, Side>>({});
  const { goals, toggleGoal } = useGoals();
  useViewport();
  const tOf = (id: InstanceId) => template(catalog, instance(state, id).templateId);
  const anyChoose = cards.some((id) => tOf(id).chooseSideOnDiscover);
  const anyLegend = cards.some((id) => stickersIn(stageTexts(tOf(id))).length > 0);
  const width = stackedWidth(cards.length, (anyChoose ? 30 : 0) + (anyLegend ? 30 : 0));
  const chosen = Object.fromEntries(Object.entries(sides).filter(([id]) => tOf(id).chooseSideOnDiscover));
  return (
    <Dialog
      title={cards.length > 1 ? "Nouvelles cartes" : "Nouvelle carte"}
      wide
      actions={
        <button className="btn btn-primary" onClick={() => onAction(Object.keys(chosen).length ? { type: "acknowledgeDiscoveries", sides: chosen } : { type: "acknowledgeDiscoveries" })}>
          {/* Début de manche : les cartes vont être mélangées ; découverte par un effet : elles sont dans la défausse. */}
          {/* Cartes permanentes seulement (Merchants 01) : elles ne vont pas dans le deck. */}
          {cards.every((id) => state.zones.permanent.includes(id))
            ? "Ajouter aux permanentes"
            : state.queue[0]?.kind === "shuffle"
              ? "Mélanger dans le deck"
              : "Ajouter au deck"}
        </button>
      }
    >
      <div className={styles.newCards}>
        {cards.map((id) => {
          const choose = tOf(id).chooseSideOnDiscover;
          const current = sides[id] ?? instance(state, id).orientation.side;
          return (
            <div key={id} className={styles.newCardRow}>
              <div className={styles.bothSides}>
              {(["front", "back"] as const).map((side) => (
                <figure key={side} className={styles.choice}>
                  <CardView
                    markId={id}
                    template={tOf(id)}
                    orientation={{ side, rotation: 0 }}
                    label={side === "front" ? "Recto" : "Verso"}
                    width={width}
                    selected={choose && current === side}
                    dimmed={choose && current !== side}
                    onTap={choose ? () => setSides({ ...sides, [id]: side }) : undefined}
                    onLongPress={(p) => {
                      // Appui long sur une moitié : objectif doré (demande du 2026-10-04).
                      const stage = stageAtPoint(tOf(id), { side, rotation: 0 }, p.y);
                      if (stage !== null) toggleGoal(id, stage);
                    }}
                    goal={(() => {
                      const v = goalView(catalog, state, goals, id);
                      return v && { stages: v.stages, arrows: [] };
                    })()}
                    exhausted={exhaustedOf(catalog, state, id)}
                    boxes={(stage) => boxViews(catalog, state, id, stage)}
                  />
                  {choose && <span className={styles.sideLabel}>{current === side ? "✓ Gardée" : "Toucher pour garder"}</span>}
                </figure>
              ))}
              </div>
              <StickerLegend texts={stageTexts(tOf(id))} />
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}

function ChoiceDialog({ catalog, state, onAction, onInspect }: { catalog: Catalog; state: GameState; onAction: (a: Action) => void; onInspect: (card: InstanceId) => void }) {
  const p = state.pending;
  const [cards, setCards] = useState<InstanceId[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  if (p?.kind !== "choice") return null;
  const req = p.request;
  const answer = (a: Answer) => {
    setCards([]);
    setResources([]);
    onAction({ type: "choose", answer: a });
  };
  const source = state.cards[p.source];
  const sourceView = source && (
    <CardView template={template(catalog, source.templateId)} orientation={source.orientation} label={cardName(catalog, state, p.source)} width={150} onLongPress={() => onInspect(p.source)} exhausted={exhaustedOf(catalog, state, p.source)}
              boxes={(stage) => boxViews(catalog, state, p.source, stage)} />
  );
  const cancel = p.cancellable && (
    <button className="btn" onClick={() => onAction({ type: "cancelChoice" })}>
      Annuler
    </button>
  );
  const one = req.type === "cards" && req.min === 1 && req.max === 1;
  const ok =
    req.type === "cards"
      ? req.need !== undefined
        ? isValidAnswer(req, { cards }) // choix pondéré (Miners compte pour 2 personnes)
        : cards.length >= req.min && cards.length <= req.max
      : req.type === "resources"
        ? resources.length === req.count
        : false;
  const actions = (
    <>
      {cancel}
      {(req.type === "resources" || (req.type === "cards" && !one)) && (
        <button
          className="btn btn-primary"
          disabled={!ok}
          onClick={() => answer(req.type === "cards" ? { cards } : { resources })}
        >
          Valider
        </button>
      )}
    </>
  );
  return (
    <Dialog title={cardName(catalog, state, p.source)} wide actions={actions}>
      <div className={styles.choiceHead}>
        {sourceView}
        <p className={styles.choicePrompt}>
          <IconText text={req.prompt} />
          {req.type === "cards" && !one && (
            <small>
              {" "}
              ({cards.length} / {req.min === req.max ? req.max : `${req.min}–${req.max}`})
            </small>
          )}
        </p>
      </div>
      {req.type === "option" && (
        <div className={styles.choiceOptions}>
          {req.labels.map((label, i) => (
            <button key={i} className="btn btn-primary" onClick={() => answer({ option: i })}>
              <IconText text={label} />
            </button>
          ))}
        </div>
      )}
      {req.type === "resources" && (
        <>
          <div className={styles.choiceOptions}>
            {req.options.map((r) => (
              <button
                key={r}
                className={styles.resourcePick}
                disabled={resources.length >= req.count}
                onClick={() => {
                  const next = [...resources, r];
                  if (req.count === 1) answer({ resources: next });
                  else setResources(next);
                }}
                aria-label={r}
              >
                <Icon id={r} />
              </button>
            ))}
          </div>
          {req.count > 1 && (
            <div className={styles.choiceOptions}>
              {resources.map((r, i) => (
                <button key={i} className={styles.resourcePicked} onClick={() => setResources(resources.filter((_, j) => j !== i))} aria-label={`Retirer ${r}`}>
                  <Icon id={r} />
                </button>
              ))}
              {Array.from({ length: req.count - resources.length }, (_, i) => (
                <span key={`e${i}`} className={styles.resourceSlot} />
              ))}
            </div>
          )}
        </>
      )}
      {req.type === "cards" && (
        <div className={styles.cardList}>
          {req.options.map((id) => {
            const picked = cards.includes(id);
            return (
              <CardView
                key={id}
                markId={id}
                template={template(catalog, instance(state, id).templateId)}
                orientation={instance(state, id).orientation}
                label={cardName(catalog, state, id)}
                width={listCard()}
                selected={picked}
                onLongPress={() => onInspect(id)}
                exhausted={exhaustedOf(catalog, state, id)}
              boxes={(stage) => boxViews(catalog, state, id, stage)}
                onTap={() => {
                  if (one) return answer({ cards: [id] });
                  if (picked) setCards(cards.filter((c) => c !== id));
                  else if (cards.length < req.max) setCards([...cards, id]);
                }}
              />
            );
          })}
        </div>
      )}
    </Dialog>
  );
}

/** Flèche entre deux étapes du parcours du royaume. */
function JourneyArrow() {
  return (
    <svg className={styles.journeyArrow} viewBox="0 0 32 16" aria-hidden="true">
      <path d="M1 8h26M21 2l7 6-7 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Fin de partie, ou d'une extension : la page de lancement des extensions (demande du 2026-10-05). En haut, le parcours
 * du royaume dans l'ordre accompli (partie de base, puis chaque extension, avec son score) ; dessous, les extensions,
 * cochées en vert quand elles sont faites, comme une carte choisie en jeu. Pas de liste de cartes : le détail de la
 * gloire reste dans Stats.
 */
export function EndDialog({
  catalog,
  state,
  onBack,
  onClose,
  onAction,
}: {
  catalog: Catalog;
  state: GameState;
  onBack: () => void;
  onClose: () => void;
  onAction: (a: Action) => void;
}) {
  const score = computeScore(catalog, state);
  const camp = state.campaign;
  // Mini-extensions (spec 4.7) : 136, 137, 138, une seule fois par royaume.
  const available = new Set(availableExpansions(state));
  const minis = Object.values(state.cards)
    .filter((c) => (EXPANSION_SERIALS as readonly number[]).includes(c.serial) && c.templateId.startsWith(`${state.config.expansion}-`))
    .sort((a, b) => a.serial - b.serial)
    .map((c) => {
      const played = camp?.played.find((p) => p.expansion === undefined && p.serial === c.serial);
      return {
        key: c.instanceId,
        name: expansionName({ catalog, s: state }, c.instanceId),
        kind: "Mini-extension",
        template: template(catalog, c.templateId),
        side: "front" as const,
        played,
        open: available.has(c.instanceId),
        action: { type: "startExpansion", card: c.instanceId } as Action,
      };
    });
  // Grandes extensions (Merchants) : le dos de leurs cartes en image ; une seule fois par royaume.
  const grandOpen = new Set(availableGrandExpansions(catalog, state));
  const grands = grandExpansions(catalog).flatMap((id) => {
    const t = catalog.templates.get(`${id}-${String(GRAND_EXPANSIONS[id]?.cover ?? 0).padStart(3, "0")}`);
    if (!t) return [];
    const played = camp?.played.find((p) => p.expansion === id);
    return [{ key: id, name: id, kind: "Extension", template: t, side: "back" as const, played, open: grandOpen.has(id), action: { type: "startGrandExpansion", expansion: id } as Action }];
  });
  const tiles = [...grands, ...minis];
  // Parcours : partie de base, puis les extensions dans l'ordre où elles ont été jouées.
  const steps = [{ name: "Partie de base", score: camp?.base ?? score.total }, ...(camp?.played ?? []).map((p) => ({ name: p.name, score: p.score }))];
  const last = camp?.played.at(-1);
  const remaining = tiles.filter((x) => x.open).length;
  return (
    <Dialog
      title={last ? (last.expansion ? `Fin de l'extension ${last.name}` : `Fin de ${last.name}`) : "Fin de la partie"}
      onClose={onClose}
      wide
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Voir le royaume
          </button>
          <button className="btn btn-primary" onClick={onBack}>
            Retour aux royaumes
          </button>
        </>
      }
    >
      <p className={styles.bigScore}>
        <IconText text={`${score.total} {fame}`} />
      </p>
      <section className={styles.journeySection}>
        <h3 className={styles.endHeading}>Parcours du royaume</h3>
        <ol className={styles.journey} aria-label="Parcours du royaume">
          {steps.map((st, i) => (
            <Fragment key={`${i}-${st.name}`}>
              {i > 0 && (
                <li className={styles.journeyArrowItem} aria-hidden="true">
                  <JourneyArrow />
                </li>
              )}
              <li className={styles.journeyStep}>
                <span className={styles.journeyIndex}>{i === 0 ? "Base" : `Étape ${i + 1}`}</span>
                <span className={styles.journeyName}>{st.name}</span>
                <span className={styles.journeyScore}>
                  <IconText text={`${st.score} {fame}`} />
                </span>
              </li>
            </Fragment>
          ))}
          {remaining > 0 && (
            <>
              <li className={styles.journeyArrowItem} aria-hidden="true">
                <JourneyArrow />
              </li>
              <li className={`${styles.journeyStep} ${styles.journeyNext}`}>
                <span className={styles.journeyIndex}>Étape {steps.length + 1}</span>
                <span className={styles.journeyName}>À choisir</span>
              </li>
            </>
          )}
        </ol>
      </section>
      <section>
        <h3 className={styles.endHeading}>{remaining > 0 ? "Choisis la prochaine extension" : "Toutes les extensions sont faites"}</h3>
        <div className={styles.expansionGrid}>
          {tiles.map((x) => (
            <figure key={x.key} className={`${styles.expansionTile} ${x.played ? styles.expansionTileDone : ""}`}>
              <CardView
                template={x.template}
                orientation={{ side: x.side, rotation: 0 }}
                label={x.name}
                width={150}
                picked={Boolean(x.played)}
                onTap={x.open ? () => onAction(x.action) : undefined}
              />
              <figcaption className={styles.expansionCaption}>
                <span className={styles.expansionKind}>{x.kind}</span>
                <span className={styles.expansionName}>{x.name}</span>
                {x.played ? (
                  <span className={styles.expansionState}>
                    Faite · <IconText text={`${x.played.score} {fame}`} />
                  </span>
                ) : x.open ? (
                  <button className="btn btn-primary" onClick={() => onAction(x.action)}>
                    Jouer
                  </button>
                ) : (
                  <span className={styles.expansionState}>Plus tard</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </Dialog>
  );
}

export function ConfirmDialog({ message, confirm, onConfirm, onCancel }: { message: string; confirm: string; onConfirm: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title="Confirmer"
      onClose={onCancel}
      actions={
        <>
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onConfirm();
            }}
          >
            {confirm}
          </button>
        </>
      }
    >
      <p>
        <IconText text={message} />
      </p>
    </Dialog>
  );
}

/** Fenêtre « Stats » : composition et production du royaume. */
export function StatsDialog({
  catalog,
  state,
  onClose,
  onShowDestroyed,
  onInspect,
}: {
  catalog: Catalog;
  state: GameState;
  onClose: () => void;
  onShowDestroyed: () => void;
  onInspect: (card: InstanceId) => void;
}) {
  const st = kingdomStats(catalog, state);
  const [allCards, setAllCards] = useState(false);
  const [fameCards, setFameCards] = useState(false);
  // Couleur de chaque case selon ce qu'elle compte (ressource, étape, type de carte).
  const cell = (label: ReactNode, value: number, tone?: string) => (
    <div className={styles.statCell} style={tone ? { background: `color-mix(in srgb, ${tone} 22%, var(--surface))`, borderColor: tone } : undefined}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
  return (
    <Dialog title="Stats du royaume" onClose={onClose} wide>
      <div className={styles.stats}>
        <section>
          <h3>Cartes</h3>
          <div className={styles.statGrid}>
            {cell("Total", st.cards.total, "var(--accent)")}
            {cell("Deck", st.cards.deck)}
            {cell("En jeu", st.cards.play)}
            {cell("Défausse", st.cards.discard)}
            {cell("Permanentes", st.cards.permanent)}
          </div>
        </section>
        <section>
          <h3>Étapes</h3>
          <div className={styles.statGrid}>
            {([1, 2, 3, 4] as const).map((n) => (
              <Fragment key={n}>{cell(`Étape ${n}`, st.stages[n], STAGE_TONES[n])}</Fragment>
            ))}
          </div>
        </section>
        <section>
          <h3>Production</h3>
          <div className={styles.statGrid}>
            {catalog.resources.map((r) => (
              <Fragment key={r}>{cell(<Icon id={r} />, st.production[r] ?? 0, RESOURCE_TONES[r])}</Fragment>
            ))}
            {st.flexible > 0 && cell("Au choix", st.flexible)}
          </div>
        </section>
        <section>
          <h3>Gloire</h3>
          <div className={styles.statGrid}>
            <button className={styles.statButton} onClick={() => setFameCards((o) => !o)} aria-pressed={fameCards}>
              {cell(<Icon id="fame" />, st.fame, "#e3b505")}
            </button>
          </div>
          {fameCards && <FameCards catalog={catalog} state={state} onInspect={onInspect} />}
        </section>
        <section>
          <h3>Types</h3>
          <div className={styles.statGrid}>
            {st.keywords.map(([k, n]) => (
              <Fragment key={k}>{cell(k, n, KEYWORD_TONES[k])}</Fragment>
            ))}
          </div>
        </section>
        <section>
          <h3>Boîte</h3>
          <div className={styles.statGrid}>
            <button className={styles.statButton} onClick={() => setAllCards((o) => !o)} aria-pressed={allCards}>
              {cell("Découvertes", st.discovered)}
            </button>
            <button className={styles.statButton} onClick={onShowDestroyed} disabled={st.destroyed === 0}>
              {cell("Détruites", st.destroyed)}
            </button>
            {cell("Dans la boîte", st.inBox)}
          </div>
          {allCards && <CardNumbers catalog={catalog} state={state} onInspect={onInspect} />}
        </section>
      </div>
    </Dialog>
  );
}

/**
 * Cartes qui rapportent ou font perdre de la gloire (demande du 2026-10-04), leur valeur posée dessus : les plus
 * rentables d'abord, les négatives à la fin. Toucher une carte l'inspecte.
 */
function FameCards({ catalog, state, onInspect }: { catalog: Catalog; state: GameState; onInspect: (card: InstanceId) => void }) {
  const score = computeScore(catalog, state);
  const lines = score.lines.filter((l) => l.fame !== 0).sort((a, b) => b.fame - a.fame);
  const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <>
      {score.purgedFame !== 0 && (
        <p className={styles.muted}>
          <IconText text={`Cartes purgées : ${sign(score.purgedFame)} {fame}`} />
        </p>
      )}
      {lines.length === 0 ? (
        <p className={styles.muted}>Aucune carte ne rapporte de gloire pour l'instant.</p>
      ) : (
        <div className={`${styles.cardList} ${styles.fameList}`}>
          {lines.map((l) => (
            <CardView
              key={l.card}
              markId={l.card}
              template={template(catalog, instance(state, l.card).templateId)}
              orientation={instance(state, l.card).orientation}
              label={`${l.name} : ${sign(l.fame)} gloire`}
              width={listCard()}
              stickers={instance(state, l.card).stickers}
              badge={
                <span className={l.fame < 0 ? styles.fameLoss : undefined}>
                  <IconText text={`${sign(l.fame)} {fame}`} />
                </span>
              }
              onTap={() => onInspect(l.card)}
              onLongPress={() => onInspect(l.card)}
              exhausted={exhaustedOf(catalog, state, l.card)}
              boxes={(stage) => boxViews(catalog, state, l.card, stage)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Toutes les cartes de l'extension par numéro (demande du 2026-10-03) : vert découverte (dans le royaume), rouge
 * détruite, gris encore dans la boîte. Toucher une carte connue l'inspecte.
 */
function CardNumbers({ catalog, state, onInspect }: { catalog: Catalog; state: GameState; onInspect: (card: InstanceId) => void }) {
  const cards = Object.values(state.cards).sort((a, b) => a.serial - b.serial);
  const status = (id: InstanceId): "known" | "destroyed" | "unknown" => {
    if (state.zones.destroyed.includes(id)) return "destroyed";
    return state.zones.box.includes(id) ? "unknown" : "known";
  };
  return (
    <div className={styles.cardNumbers}>
      {cards.map((c) => {
        const s = status(c.instanceId);
        const label = s === "unknown" ? `#${c.serial}` : `#${c.serial} ${cardName(catalog, state, c.instanceId)}`;
        return (
          <button
            key={c.instanceId}
            className={`${styles.cardNumber} ${styles[`cardNumber_${s}`]}`}
            disabled={s === "unknown"}
            onClick={() => onInspect(c.instanceId)}
            aria-label={label}
          >
            {c.serial}
          </button>
        );
      })}
    </div>
  );
}

const STAGE_TONES: Record<1 | 2 | 3 | 4, string> = { 1: "#2e8b3d", 2: "#e3b505", 3: "#e07b1a", 4: "#c62828" };

const RESOURCE_TONES: Record<string, string> = {
  coin: "#e3b505",
  wood: "#8b5a2b",
  stone: "#6f8f80",
  metal: "#9aa3ad",
  sword: "#5f6b78",
  tradeGood: "#b5651d",
};

// Types en anglais (texte des cartes), couleur du bandeau (spec 7.4).
const KEYWORD_TONES: Record<string, string> = {
  Land: "var(--cat-land)",
  Building: "var(--cat-building)",
  Person: "var(--cat-person)",
  Livestock: "var(--cat-livestock)",
  Seafaring: "var(--cat-seafaring)",
  Event: "var(--cat-other)",
  Enemy: "var(--cat-negative)",
  Goal: "var(--cat-goal)",
  // Sous-types : couleur de leur bandeau (demande du 2026-10-04 : Invention en rose, Knight en jaune comme les personnes).
  Invention: "var(--cat-other)",
  Knight: "var(--cat-person)",
  Lady: "var(--cat-person)",
  Elder: "var(--cat-person)",
  Ship: "var(--cat-seafaring)",
  Horse: "var(--cat-livestock)",
};

/** Bulle de traduction d'une moitié de carte (toucher hors des zones d'action, infobulles FR activées). */
