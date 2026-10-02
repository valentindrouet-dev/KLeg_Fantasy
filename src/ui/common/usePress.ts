import { useRef, type MouseEvent, type PointerEvent } from "react";

// Tap, appui long et toucher à deux doigts (spec 7.5) : doigt, souris, trackpad et Pencil via Pointer Events.
// Clic droit = appui long (inspection). Alt + clic = toucher à deux doigts (ordinateur).

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

/** Position du tap, relative à l'élément (0..1). */
export type TapPoint = { x: number; y: number };

export function usePress(onTap: (p: TapPoint) => void, onLongPress?: () => void, onTwoFinger?: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const pointers = useRef(new Set<number>());
  const multi = useRef(false); // un deuxième doigt s'est posé : ni tap ni appui long

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
      if (onLongPress) {
        timer.current = window.setTimeout(() => {
          fired.current = true;
          onLongPress();
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
      release(e);
      cancel();
      if (!wasPressed || fired.current || wasMulti) return;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onTap({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    },
    onPointerLeave: (e: PointerEvent) => {
      release(e);
      cancel();
    },
    onPointerCancel: (e: PointerEvent) => {
      release(e);
      cancel();
    },
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      if (onLongPress) onLongPress();
    },
  };
}
