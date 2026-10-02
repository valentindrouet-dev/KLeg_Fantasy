import { readCardFiles, readResources } from "../../scripts/cardFiles";
import { createCatalog, type Catalog } from "../../src/engine";

// Catalogue chargé une fois depuis data/cards pour les tests et les scripts Node.

let cached: Promise<Catalog> | undefined;

export function loadCatalog(): Promise<Catalog> {
  cached ??= (async () => {
    const resources = await readResources();
    const files = await readCardFiles("data/cards", resources);
    const templates = files.flatMap((f) => (f.result.ok ? [f.result.card] : []));
    return createCatalog(templates, resources.map((r) => r.id));
  })();
  return cached;
}
