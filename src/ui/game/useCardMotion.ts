import { useLayoutEffect, useRef, type RefObject } from "react";
import { cardImageUrl } from "../../data/loadCards";
import { instance, template, zoneOf, type Catalog, type GameState, type InstanceId } from "../../engine";

// Mouvements des cartes entre deux états (demande du 2026-10-02) : les cartes qui quittent la zone de jeu
// volent vers la défausse (ou s'effacent si elles sont détruites), celles qui arrivent glissent depuis
// la pioche (ou la défausse), celles qui restent se replacent en douceur. Web Animations API, sans React.

const DURATION = 480;
const EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const STAGGER = 70;

type Snapshot = { rects: Map<InstanceId, DOMRect>; state: GameState };

/** Copies volantes en cours, retirées si l'écran de partie se ferme. */
const ghosts = new Set<HTMLElement>();

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function pileRect(name: "deck" | "discard"): DOMRect | null {
  return document.querySelector(`[data-pile="${name}"]`)?.getBoundingClientRect() ?? null;
}

function moveFrom(from: DOMRect, to: DOMRect): string {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${from.width / Math.max(1, to.width)})`;
}

/** Copie volante d'une carte qui a quitté la zone de jeu. */
function ghost(catalog: Catalog, state: GameState, id: InstanceId, from: DOMRect, to: DOMRect | null, delay: number): void {
  const c = instance(state, id);
  const t = template(catalog, c.templateId);
  const url = cardImageUrl(c.orientation.side === "front" ? t.images.front : t.images.back);
  if (!url) return;
  const el = document.createElement("img");
  el.src = url;
  Object.assign(el.style, {
    position: "fixed",
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    borderRadius: "4.5% / 3.2%",
    boxShadow: "0 6px 16px rgb(0 0 0 / 0.35)",
    zIndex: "20",
    pointerEvents: "none",
    rotate: c.orientation.rotation === 180 ? "180deg" : "0deg",
  });
  document.body.appendChild(el);
  ghosts.add(el);
  const end = to ? { transform: moveFrom(to, from), opacity: 0.9 } : { transform: "scale(0.6)", opacity: 0 };
  const anim = el.animate([{ transform: "none", opacity: 1 }, end], { duration: DURATION, delay, easing: EASING, fill: "forwards" });
  const remove = () => {
    el.remove();
    ghosts.delete(el);
  };
  anim.onfinish = remove;
  anim.oncancel = remove;
}

export function useCardMotion(catalog: Catalog, state: GameState | null, play: RefObject<HTMLElement | null>): void {
  const prev = useRef<Snapshot | null>(null);

  useLayoutEffect(
    () => () => {
      for (const g of ghosts) g.remove();
      ghosts.clear();
    },
    [],
  );

  useLayoutEffect(() => {
    const zone = play.current;
    if (!state || !zone) return;
    const els = new Map<InstanceId, HTMLElement>();
    zone.querySelectorAll<HTMLElement>("[data-card]").forEach((el) => {
      if (el.dataset.card) els.set(el.dataset.card, el);
    });
    const rects = new Map([...els].map(([id, el]) => [id, el.getBoundingClientRect()] as const));
    const before = prev.current;
    prev.current = { rects, state };
    if (!before || before.state === state || reducedMotion()) return;

    const deck = pileRect("deck");
    const discard = pileRect("discard");

    // Cartes parties : vers la défausse, vers la pioche, ou effacées (détruites, permanentes…).
    let out = 0;
    for (const [id, from] of before.rects) {
      if (els.has(id)) continue;
      const where = zoneOf(state, id);
      const to = where === "discard" ? discard : where === "deck" ? deck : null;
      ghost(catalog, state, id, from, to, out++ * 40);
    }

    // Cartes arrivées (depuis la pioche ou la défausse) et cartes déplacées.
    let i = 0;
    for (const [id, el] of els) {
      const to = rects.get(id);
      if (!to) continue;
      const old = before.rects.get(id);
      if (!old) {
        const fromZone = zoneOf(before.state, id);
        const from = fromZone === "discard" ? discard : deck;
        if (!from) continue;
        el.animate([{ transform: moveFrom(from, to), opacity: 0.4 }, { transform: "none", opacity: 1 }], {
          duration: DURATION,
          delay: (out > 0 ? 180 : 0) + i++ * STAGGER,
          easing: EASING,
          fill: "backwards",
        });
      } else if (Math.abs(old.left - to.left) > 1 || Math.abs(old.top - to.top) > 1 || Math.abs(old.width - to.width) > 1) {
        el.animate([{ transform: moveFrom(old, to) }, { transform: "none" }], { duration: 320, easing: EASING });
      }
    }
  }, [catalog, state, play]);
}
