import type { CardTemplate, Orientation } from "../../data/schema";
import { stageFr } from "../../data/translations";
import { isFullImage, stageIdAt } from "../../engine";
import type { CardNote } from "./CardView";

// Traduction française posée sur la carte (mode FR, demande du 2026-10-02) : la moitié touchée, ou toute la carte
// pour une carte à image pleine (une seule étape par face).

export function frNote(t: CardTemplate, o: Orientation, half: "top" | "bottom"): CardNote | undefined {
  const full = isFullImage(t);
  const stageId = stageIdAt(t, half === "top" || full ? o : { side: o.side, rotation: o.rotation === 0 ? 180 : 0 });
  if (stageId === null) return undefined;
  const fr = stageFr(t.id, stageId);
  const name = t.stages[String(stageId) as "1"]?.name ?? "";
  if (!fr) return undefined;
  return { half: full ? "full" : half, title: fr.name || name, text: fr.text, tone: "fr" };
}
