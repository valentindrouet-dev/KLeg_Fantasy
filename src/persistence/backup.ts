import { z } from "zod";
import { current, replay, type Action, type Catalog } from "../engine";
import { newKingdomId, summarize, type Kingdom } from "./kingdoms";

// Sauvegarde d'un royaume dans un fichier (spec 6.2 : export / import JSON).
// À l'import, la partie est rejouée depuis son enregistrement : un fichier incohérent est refusé,
// et l'état obtenu est toujours celui du moteur actuel.

const FORMAT = "kleg-fantasy-kingdom";

const BackupSchema = z.object({
  format: z.literal(FORMAT),
  appVersion: z.string(),
  exportedAt: z.string(),
  kingdom: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    emoji: z.string(),
    createdAt: z.number(),
    playMs: z.number().nonnegative().optional(),
    milestones: z.array(z.object({ step: z.string(), at: z.number(), playMs: z.number() })).optional(),
    record: z.object({
      config: z.object({ expansion: z.string().min(1), seed: z.number(), undoMode: z.enum(["strict", "free"]) }),
      actions: z.array(z.record(z.string(), z.unknown())),
    }),
  }),
});

export function exportKingdom(k: Kingdom, appVersion: string): string {
  const { id, name, emoji, createdAt, record, playMs, milestones } = k;
  return JSON.stringify({ format: FORMAT, appVersion, exportedAt: new Date().toISOString(), kingdom: { id, name, emoji, createdAt, playMs, milestones, record } }, null, 1);
}

export function backupFileName(k: Kingdom): string {
  const day = new Date().toISOString().slice(0, 10);
  const safe = k.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-");
  return `royaume-${safe}-${day}.json`;
}

/** Lit un fichier de sauvegarde et rejoue la partie. Lève une erreur lisible si le fichier ne convient pas. */
export function importKingdom(catalog: Catalog, text: string, takenIds: readonly string[]): Kingdom {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde (JSON illisible).");
  }
  const parsed = BackupSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Ce fichier n'est pas une sauvegarde de royaume.");
  const { kingdom } = parsed.data;
  const record = { config: kingdom.record.config, actions: kingdom.record.actions as Action[] };
  let state;
  try {
    state = current(replay(catalog, record));
  } catch {
    throw new Error("La partie de cette sauvegarde ne peut pas être rejouée.");
  }
  const clash = takenIds.includes(kingdom.id);
  const now = Date.now();
  return {
    id: clash ? newKingdomId() : kingdom.id,
    name: clash ? `${kingdom.name} (importé)` : kingdom.name,
    emoji: kingdom.emoji,
    createdAt: kingdom.createdAt,
    updatedAt: now,
    summary: summarize(catalog, record, state),
    record,
    state,
    ...(kingdom.playMs !== undefined ? { playMs: kingdom.playMs } : {}),
    ...(kingdom.milestones ? { milestones: kingdom.milestones } : {}),
  };
}
