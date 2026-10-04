import { useRef, type MouseEvent, type PointerEvent } from "react";

// Tap, appui long, toucher à deux doigts (spec 7.5) et glissé horizontal (« rayer » la carte, demande du 2026-10-04) :
// doigt, souris, trackpad et Pencil via Pointer Events. Clic droit = appui long (inspection). Alt + clic = toucher à
// deux doigts (ordinateur).

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;
/** Glissé : au moins 40 px (ou un tiers de la carte), nettement plus horizontal que vertical. */
const SWIPE_MIN_PX = 40;
const SWIPE_MIN_SHARE = 0.33;

/** Position du tap, relative à l'élément (0..1). */
export type TapPoint = { x: number; y: number };

export function usePress(onTap: (p: TapPoint) => void, onLongPress?: (p: TapPoint) => void, onTwoFinger?: () => void, onSwipe?: () => void) {
  const el = useRef<HTMLElement | null>(null);
  /** Position relative d'un point écran dans l'élément pressé. */
  const at = (x: number, y: number): TapPoint => {
    const r = el.current?.getBoundingClientRect();
    return r ? { x: (x - r.left) / r.width, y: (y - r.top) / r.height } : { x: 0.5, y: 0.5 };
  };
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const pointers = useRef(new Set<number>());
  const multi = useRef(false); // un deuxième doigt s'est posé : ni tap ni appui long
  const swipe = useRef<{ x: number; y: number; width: number } | null>(null);

  const cancel = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  };

  const release = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) multi.current = false;
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      // Premier doigt d'un nouveau geste : les doigts encore comptés sont des restes (lever perdu, carte redessinée).
      // Sans ça, chaque toucher passait pour un toucher à deux doigts : drapeau bleu figé, carte inutilisable.
      if (e.isPrimary) {
        pointers.current.clear();
        multi.current = false;
      }
      pointers.current.add(e.pointerId);
      if (pointers.current.size >= 2) {
        // Deux doigts sur la même carte.
        if (!multi.current) onTwoFinger?.();
        multi.current = true;
        cancel();
        return;
      }
      if (e.altKey && onTwoFinger) {
        onTwoFinger();
        multi.current = true;
        return;
      }
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      el.current = e.currentTarget as HTMLElement;
      if (onSwipe) {
        swipe.current = { x: e.clientX, y: e.clientY, width: el.current.getBoundingClientRect().width };
        // Le doigt peut sortir de la carte pendant le glissé : la carte garde le pointeur jusqu'au lâcher.
        try {
          el.current.setPointerCapture?.(e.pointerId);
        } catch {
          // Pointeur déjà relâché : pas de capture, le geste reste un tap.
        }
      }
      if (onLongPress) {
        const p = { x: e.clientX, y: e.clientY };
        timer.current = window.setTimeout(() => {
          fired.current = true;
          onLongPress(at(p.x, p.y));
        }, LONG_PRESS_MS);
      }
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE) cancel();
    },
    onPointerUp: (e: PointerEvent) => {
      const wasPressed = start.current !== null;
      const wasMulti = multi.current;
      const sw = swipe.current;
      swipe.current = null;
      release(e);
      cancel();
      if (sw && !wasMulti && !fired.current && onSwipe) {
        const dx = Math.abs(e.clientX - sw.x);
        const dy = Math.abs(e.clientY - sw.y);
        if (dx >= Math.max(SWIPE_MIN_PX, sw.width * SWIPE_MIN_SHARE) && dx > 1.5 * dy) {
          onSwipe();
          return;
        }
      }
      if (!wasPressed || fired.current || wasMulti) return;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onTap({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    },
    onPointerLeave: (e: PointerEvent) => {
      release(e);
      cancel();
    },
    onPointerCancel: (e: PointerEvent) => {
      swipe.current = null;
      release(e);
      cancel();
    },
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      el.current = e.currentTarget as HTMLElement;
      if (onLongPress) onLongPress(at(e.clientX, e.clientY));
    },
  };
}
