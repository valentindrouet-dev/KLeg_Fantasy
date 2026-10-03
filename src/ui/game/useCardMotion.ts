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

/** Élément volant à l'image d'une carte, posé sur `rect` (retiré quand son animation se termine). */
function flyer(catalog: Catalog, state: GameState, id: InstanceId, rect: DOMRect, z = 20): HTMLElement | null {
  const c = instance(state, id);
  const t = template(catalog, c.templateId);
  const url = cardImageUrl(c.orientation.side === "front" ? t.images.front : t.images.back);
  if (!url) return null;
  // Le conteneur se déplace, l'image à l'intérieur porte la rotation de la carte : une rotation posée sur
  // l'élément animé inverserait le sens du déplacement (carte tournée qui partait à l'opposé de la défausse).
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: String(z),
    pointerEvents: "none",
  });
  const img = document.createElement("img");
  img.src = url;
  Object.assign(img.style, {
    display: "block",
    width: "100%",
    height: "100%",
    borderRadius: "4.5% / 3.2%",
    boxShadow: "0 6px 16px rgb(0 0 0 / 0.35)",
    transform: c.orientation.rotation === 180 ? "rotate(180deg)" : "none",
  });
  el.appendChild(img);
  document.body.appendChild(el);
  ghosts.add(el);
  return el;
}

function animateAndRemove(el: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions): void {
  const anim = el.animate(keyframes, { fill: "both", ...options });
  const remove = () => {
    el.remove();
    ghosts.delete(el);
  };
  anim.onfinish = remove;
  anim.oncancel = remove;
}

/** Copie volante d'une carte qui a quitté la zone de jeu. */
function ghost(catalog: Catalog, state: GameState, id: InstanceId, from: DOMRect, to: DOMRect | null, delay: number): void {
  const el = flyer(catalog, state, id, from);
  if (!el) return;
  const end = to ? { transform: moveFrom(to, from), opacity: 0.9 } : { transform: "scale(0.6)", opacity: 0 };
  animateAndRemove(el, [{ transform: "none", opacity: 1 }, end], { duration: DURATION, delay, easing: EASING });
}

const GATHER_MAX = 12; // cartes montrées en vol de la défausse vers la pioche
const GATHER_STAGGER = 55;
const RIFFLE = 820;

/**
 * Nouveau deck (début de manche) : les cartes de la défausse (et celles restées en jeu) volent vers la pioche,
 * la pioche est battue, puis le tour commence. Renvoie la durée de la séquence, pour retarder les cartes jouées.
 */
function reshuffle(catalog: Catalog, before: Snapshot, state: GameState, deck: DOMRect, discard: DOMRect | null): number {
  // Les cartes que la fenêtre « Nouvelles cartes » montrait partent du centre de l'écran, en premier.
  const fresh = before.state.pending?.kind === "newCards" ? before.state.pending.cards : [];
  const fromPlay = [...before.rects].filter(([id]) => !state.zones.play.includes(id));
  const fromDiscard = before.state.zones.discard.filter((id) => !fresh.includes(id)).slice(-Math.max(0, GATHER_MAX - fromPlay.length - fresh.length));
  let n = 0;
  for (const id of fresh) ghostTo(catalog, state, id, centerRect(fresh.length, fresh.indexOf(id)), deck, n++ * GATHER_STAGGER * 2);
  for (const [id, rect] of fromPlay) ghostTo(catalog, state, id, rect, deck, n++ * GATHER_STAGGER);
  if (discard) for (const id of fromDiscard) ghostTo(catalog, state, id, discard, deck, n++ * GATHER_STAGGER);
  const gathered = Math.max(0, n - 1) * GATHER_STAGGER + DURATION;

  // Pioche cachée jusqu'à l'arrivée des cartes, puis battue (deux paquets qui s'écartent et se rejoignent).
  const pile = document.querySelector<HTMLElement>('[data-pile="deck"]');
  pile?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: gathered - 120, fill: "backwards" });
  pile?.animate(
    [
      { transform: "none" },
      { transform: "translateX(-6px) rotate(-3deg)" },
      { transform: "translateX(6px) rotate(3deg)" },
      { transform: "translateX(-4px) rotate(-2deg)" },
      { transform: "translateX(4px) rotate(2deg)" },
      { transform: "none" },
    ],
    { duration: RIFFLE, delay: gathered, easing: "ease-in-out" },
  );
  const halves = state.zones.deck.slice(0, 2);
  halves.forEach((id, i) => {
    const el = flyer(catalog, state, id, deck, 21);
    if (!el) return;
    const dir = i === 0 ? -1 : 1;
    const out = `translateX(${dir * deck.width * 0.55}px) rotate(${dir * 9}deg)`;
    animateAndRemove(el, [{ transform: "none", opacity: 0 }, { transform: out, opacity: 1, offset: 0.25 }, { transform: "none", opacity: 1, offset: 0.5 }, { transform: out, opacity: 1, offset: 0.75 }, { transform: "none", opacity: 0 }], {
      duration: RIFFLE,
      delay: gathered,
      easing: "ease-in-out",
    });
  });
  return gathered + RIFFLE;
}

/** Place d'une carte (parmi `count`) montrée au centre de l'écran, comme dans la fenêtre des nouvelles cartes. */
function centerRect(count: number, i: number): DOMRect {
  const w = Math.min(240, (window.innerWidth - 80) / Math.max(1, count));
  const h = w / (373 / 520);
  const left = window.innerWidth / 2 - (count * w) / 2 + i * w;
  return new DOMRect(left, window.innerHeight / 2 - h / 2, w, h);
}

/** Copie volante vers la pioche, qui disparaît en s'y posant. */
function ghostTo(catalog: Catalog, state: GameState, id: InstanceId, from: DOMRect, to: DOMRect, delay: number): void {
  const el = flyer(catalog, state, id, from);
  if (!el) return;
  animateAndRemove(el, [{ transform: "none", opacity: 1 }, { transform: moveFrom(to, from), opacity: 1, offset: 0.9 }, { transform: moveFrom(to, from), opacity: 0 }], {
    duration: DURATION + 80,
    delay,
    easing: EASING,
  });
}

const SHATTER = 1500;
// Cassure en zigzag au milieu de la carte : la moitié haute garde le dessus du zigzag, la basse le dessous.
const CRACK = "0% 52%, 12% 46%, 24% 54%, 38% 45%, 50% 53%, 63% 46%, 76% 55%, 88% 47%, 100% 51%";
const TOP_HALF = `polygon(0% 0%, 100% 0%, ${CRACK.split(", ").reverse().join(", ")})`;
const BOTTOM_HALF = `polygon(${CRACK}, 100% 100%, 0% 100%)`;

/**
 * Carte détruite (demande du 2026-10-03) : elle apparaît au milieu de l'écran, se brise en deux et ses deux moitiés
 * tombent vers le bas.
 */
function shatter(catalog: Catalog, state: GameState, id: InstanceId, i: number, count: number): void {
  const w = Math.min(260, (window.innerWidth - 80) / Math.max(1, count));
  const h = w / (373 / 520);
  const rect = new DOMRect(window.innerWidth / 2 - (count * w) / 2 + i * w, window.innerHeight / 2 - h / 2, w, h);
  const fall = window.innerHeight - rect.top + 40;
  ([
    [TOP_HALF, -1],
    [BOTTOM_HALF, 1],
  ] as const).forEach(([clip, dir]) => {
    const el = flyer(catalog, state, id, rect, 80);
    if (!el) return;
    el.style.clipPath = clip;
    animateAndRemove(
      el,
      [
        { transform: "scale(0.6)", opacity: 0, offset: 0 },
        { transform: "scale(1)", opacity: 1, offset: 0.18, easing: "ease-out" },
        { transform: "scale(1)", opacity: 1, offset: 0.42 },
        { transform: `translate(${dir * 8}px, ${dir * 5}px) rotate(${dir * 4}deg)`, opacity: 1, offset: 0.52, easing: "ease-in" },
        { transform: `translate(${dir * 70}px, ${fall + (dir > 0 ? 60 : 0)}px) rotate(${dir * 28}deg)`, opacity: 0.85, offset: 1 },
      ],
      { duration: SHATTER, delay: i * 220 },
    );
  });
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

    // Nouveau deck : la pioche était vide et ne l'est plus (seul le mélange de début de manche fait ça).
    const shuffled = before.state.zones.deck.length === 0 && state.zones.deck.length > 0;
    const shuffleTime = shuffled && deck ? reshuffle(catalog, before, state, deck, discard) : 0;

    // Cartes découvertes en cours de partie (effets) : elles arrivent du centre de l'écran vers la défausse.
    if (!shuffled && discard) {
      const found = Object.keys(state.cards).filter((id) => zoneOf(before.state, id) === "box" && zoneOf(state, id) === "discard");
      found.forEach((id, i) => ghostTo(catalog, state, id, centerRect(found.length, i), discard, 250 + i * 120));
    }

    // Cartes détruites (hors parchemins lus et cartes jamais sorties de la boîte) : elles se brisent au centre.
    const destroyed = state.zones.destroyed.filter(
      (id) => !before.state.zones.destroyed.includes(id) && zoneOf(before.state, id) !== "box" && !template(catalog, instance(state, id).templateId).isParchment,
    );
    destroyed.forEach((id, n) => shatter(catalog, state, id, n, destroyed.length));

    // Cartes parties : vers la défausse, vers la pioche, ou effacées (permanentes…).
    let out = 0;
    for (const [id, from] of shuffled ? [] : before.rects) {
      if (els.has(id)) continue;
      const where = zoneOf(state, id);
      if (where === "destroyed") continue; // déjà brisée au centre
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
        const from = fromZone === "discard" && !shuffled ? discard : deck;
        if (!from) continue;
        el.animate([{ transform: moveFrom(from, to), opacity: 0.4 }, { transform: "none", opacity: 1 }], {
          duration: DURATION,
          delay: shuffleTime + (out > 0 ? 180 : 0) + i++ * STAGGER,
          easing: EASING,
          fill: "backwards",
        });
      } else if (Math.abs(old.left - to.left) > 1 || Math.abs(old.top - to.top) > 1 || Math.abs(old.width - to.width) > 1) {
        el.animate([{ transform: moveFrom(old, to) }, { transform: "none" }], { duration: 320, easing: EASING });
      }
    }
  }, [catalog, state, play]);
}
