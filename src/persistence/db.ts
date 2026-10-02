import { Dexie, type EntityTable } from "dexie";
import { newKingdomId, type Kingdom } from "./kingdoms";

// Stockage des royaumes dans IndexedDB (spec 6.2) : un enregistrement par royaume, sauvegardé après chaque action.

class KingdomDb extends Dexie {
  kingdoms!: EntityTable<Kingdom, "id">;

  constructor() {
    super("kleg-fantasy");
    this.version(1).stores({ kingdoms: "id, updatedAt" });
  }
}

let db: KingdomDb | undefined;
function getDb(): KingdomDb {
  db ??= new KingdomDb();
  return db;
}

export async function listKingdoms(): Promise<Kingdom[]> {
  return getDb().kingdoms.orderBy("updatedAt").reverse().toArray();
}

export async function getKingdom(id: string): Promise<Kingdom | undefined> {
  return getDb().kingdoms.get(id);
}

export async function saveKingdom(k: Kingdom): Promise<void> {
  await getDb().kingdoms.put(k);
}

export async function deleteKingdom(id: string): Promise<void> {
  await getDb().kingdoms.delete(id);
}

export async function renameKingdom(id: string, name: string, emoji: string): Promise<void> {
  await getDb().kingdoms.update(id, { name, emoji });
}

/** Copie complète d'un royaume à l'instant T (spec 6.1). */
export async function duplicateKingdom(id: string): Promise<Kingdom | undefined> {
  const k = await getKingdom(id);
  if (!k) return undefined;
  const now = Date.now();
  const copy: Kingdom = { ...structuredClone(k), id: newKingdomId(), name: `${k.name} (copie)`, createdAt: now, updatedAt: now };
  await saveKingdom(copy);
  return copy;
}

/** Spec 7.6 bis : demander au navigateur de ne pas effacer les sauvegardes. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    // Typage minimal : ce fichier est aussi compilé côté Node (tests), sans les types DOM.
    const nav = globalThis.navigator as { storage?: { persist?: () => Promise<boolean> } } | undefined;
    return (await nav?.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
