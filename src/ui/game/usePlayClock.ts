import { useEffect, useRef, useState } from "react";

const FLUSH_MS = 15000;
/** Écart maximal compté d'un coup : un minuteur endormi (iPad en veille) ne compte pas le temps d'absence. */
const MAX_STEP_MS = 5000;

/**
 * Chronomètre de partie (demande du 2026-10-04) : compte seulement quand l'appli est à l'écran et que `running` est
 * vrai. Le temps est versé à `flush` toutes les 15 s, quand l'appli passe en arrière-plan et en quittant l'écran.
 * Renvoie le temps compté pas encore versé, pour l'affichage.
 */
export function usePlayClock(running: boolean, flush: (ms: number) => void): number {
  const [pending, setPending] = useState(0);
  const acc = useRef(0);
  const last = useRef<number | null>(null);
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    if (!running) return;
    const visible = () => document.visibilityState === "visible";
    const take = () => {
      const now = performance.now();
      if (last.current !== null) acc.current += Math.min(MAX_STEP_MS, Math.max(0, now - last.current));
      last.current = visible() ? now : null;
    };
    const pour = () => {
      if (acc.current > 0) flushRef.current(acc.current);
      acc.current = 0;
      setPending(0);
    };
    last.current = visible() ? performance.now() : null;
    const timer = window.setInterval(() => {
      take();
      if (acc.current >= FLUSH_MS) pour();
      else setPending(acc.current);
    }, 1000);
    const onVisibility = () => {
      take();
      if (!visible()) pour();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      take();
      last.current = null;
      pour();
    };
  }, [running]);

  return pending;
}
