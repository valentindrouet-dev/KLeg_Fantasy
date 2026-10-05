import { useEffect, useState } from "react";
import { availableExpansions, loadExpansion, resources } from "../../data/loadCards";
import { createCatalog, DEFAULT_EXPANSION, GRAND_EXPANSIONS, type Catalog } from "../../engine";

// Catalogue des cartes côté navigateur, chargé une seule fois : la boîte de base et les grandes extensions jouables
// (Merchants). Une partie ne prend que les cartes de sa boîte ; une grande extension ajoute les siennes à son lancement.

let pending: Promise<Catalog> | undefined;

export function loadCatalog(): Promise<Catalog> {
  const ids = [DEFAULT_EXPANSION, ...Object.keys(GRAND_EXPANSIONS).filter((id) => availableExpansions().includes(id))];
  pending ??= Promise.all(ids.map(loadExpansion)).then((all) => {
    const templates = all.flat().flatMap((c) => (c.result.ok ? [c.result.card] : []));
    return createCatalog(templates, resources.map((r) => r.id));
  });
  return pending;
}

export function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCatalog().then((c) => alive && setCatalog(c));
    return () => {
      alive = false;
    };
  }, []);
  return catalog;
}
