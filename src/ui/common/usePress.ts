import { useRef, type MouseEvent, type PointerEvent } from "react";

// Tap et appui long (spec 7.5) : doigt, souris, trackpad et Pencil via Pointer Events.
// Clic droit = appui long (inspection).

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

export function usePress(onTap: () => void, onLongPress?: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
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
    onPointerUp: () => {
      const wasPressed = start.current !== null;
      cancel();
      if (wasPressed && !fired.current) onTap();
    },
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      if (onLongPress) onLongPress();
    },
  };
}
