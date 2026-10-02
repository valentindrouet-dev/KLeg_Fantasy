import { useEffect, useState } from "react";
import { loadExpansion, resources } from "../../data/loadCards";
import { createCatalog, DEFAULT_EXPANSION, type Catalog } from "../../engine";

// Catalogue des cartes côté navigateur, chargé une seule fois.

let pending: Promise<Catalog> | undefined;

export function loadCatalog(): Promise<Catalog> {
  pending ??= loadExpansion(DEFAULT_EXPANSION).then((cards) => {
    const templates = cards.flatMap((c) => (c.result.ok ? [c.result.card] : []));
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
