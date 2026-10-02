import { describe, expect, it } from "vitest";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, run } from "../helpers/game";

// Spec 4.4, action 3 : utiliser un effet (cartes 1 à 10).
describe("effets des cartes de départ", async () => {
  const catalog = await loadCatalog();
  const front180 = { side: "front", rotation: 180 } as const;
  const back0 = { side: "back", rotation: 0 } as const;
  const back180 = { side: "back", rotation: 180 } as const;

  it("Forest : une rotation par effet ne termine pas le tour mais défausse la carte", () => {
    let s = arrange(catalog, { play: [7, 1], deck: [2, 3] });
    s = run(catalog, s, { type: "useEffect", card: fk(7), effect: "e1", targets: [], option: null });
    expect(s.resources.wood).toBe(3);
    expect(s.cards[fk(7)]?.orientation).toEqual(front180); // Felled Forest
    expect(s.zones.discard).toEqual([fk(7)]);
    expect(s.turn).toBe(1);
    expect(s.zones.play).toEqual([fk(1)]);
  });

  it("Plains : défausser une autre carte amie en jeu pour 2 pièces", () => {
    const s = arrange(catalog, { play: [1, 2, 3], orientation: { 1: front180 } });
    const uses = legal(catalog, s).filter((a) => a.type === "useEffect");
    expect(uses.map((a) => (a.type === "useEffect" ? a.targets : []))).toEqual([[fk(2)], [fk(3)]]);
  });

  it("Plains : sans autre carte en jeu, l'effet est indisponible", () => {
    const s = arrange(catalog, { play: [1], orientation: { 1: front180 } });
    expect(legal(catalog, s).some((a) => a.type === "useEffect")).toBe(false);
  });

  it("Trader : dépenser 1 pièce pour 1 bois, seulement avec une pièce", () => {
    expect(legal(catalog, arrange(catalog, { play: [10] })).some((a) => a.type === "useEffect")).toBe(false);
    let s = arrange(catalog, { play: [10], resources: { coin: 1 } });
    s = run(catalog, s, { type: "useEffect", card: fk(10), effect: "e1", targets: [], option: 0 });
    expect(s.resources).toMatchObject({ coin: 0, wood: 1 });
    expect(s.zones.discard).toEqual([fk(10)]);
  });

  it("Bazaar : le « / » se choisit (bois ou pierre)", () => {
    let s = arrange(catalog, { play: [10], resources: { coin: 1 }, orientation: { 10: front180 } });
    expect(legal(catalog, s).filter((a) => a.type === "useEffect")).toHaveLength(2);
    s = run(catalog, s, { type: "useEffect", card: fk(10), effect: "e1", targets: [], option: 1 });
    expect(s.resources).toMatchObject({ coin: 0, stone: 1, wood: 0 });
  });

  it("Rocky Area : 1 pièce pour 2 pierres", () => {
    let s = arrange(catalog, { play: [5], resources: { coin: 1 }, orientation: { 5: front180 } });
    s = run(catalog, s, { type: "useEffect", card: fk(5), effect: "e1", targets: [], option: 0 });
    expect(s.resources.stone).toBe(2);
  });

  it("Town Hall : jouer une terre depuis la défausse, les ressources en cours restent", () => {
    let s = arrange(catalog, { play: [9], discard: [1, 10], resources: { coin: 2 }, orientation: { 9: front180 } });
    const targets = legal(catalog, s).flatMap((a) => (a.type === "useEffect" ? a.targets : []));
    expect(targets).toEqual([fk(1)]); // Trader (personne) exclu
    s = run(catalog, s, { type: "useEffect", card: fk(9), effect: "e1", targets: [fk(1)], option: null });
    expect(s.zones.play).toEqual([fk(1)]);
    expect(s.zones.discard).toEqual([fk(10), fk(9)]);
    expect(s.resources.coin).toBe(2);
    expect(s.lostResources).toEqual({});
  });

  it("Keep : une terre ou un bâtiment", () => {
    const s = arrange(catalog, { play: [9], discard: [1, 10, 2], orientation: { 9: back180, 2: back0 } });
    const targets = legal(catalog, s).flatMap((a) => (a.type === "useEffect" ? a.targets : []));
    expect(targets.sort()).toEqual([fk(1), fk(2)]); // Wild Grass (terre), Food Barns (bâtiment)
  });

  it("Castle : n'importe quelle carte, sauf lui-même", () => {
    const s = arrange(catalog, { play: [9], discard: [1, 10], orientation: { 9: back0 } });
    const targets = legal(catalog, s).flatMap((a) => (a.type === "useEffect" ? a.targets : []));
    expect(targets.sort()).toEqual([fk(1), fk(10)]);
  });

  it("Shallow Mine : détruire la carte, voir 84 et 85, en découvrir une, l'autre reste dans la boîte", () => {
    let s = arrange(catalog, { play: [5], orientation: { 5: back0 } });
    s = run(catalog, s, { type: "useEffect", card: fk(5), effect: "e1", targets: [], option: null });
    expect(s.zones.destroyed).toEqual([fk(5)]);
    expect(s.pending).toMatchObject({ kind: "discoverChoice", options: [fk(84), fk(85)] });
    expect(legal(catalog, s)).toEqual([
      { type: "chooseDiscovery", card: fk(84) },
      { type: "chooseDiscovery", card: fk(85) },
    ]);
    s = run(catalog, s, { type: "chooseDiscovery", card: fk(85) });
    expect(s.pending).toBeNull();
    expect(s.zones.discard).toEqual([fk(85)]);
    expect(s.zones.box).toContain(fk(84));
  });

  it("Sacred Well : découvre un Shrine (82 / 83)", () => {
    let s = arrange(catalog, { play: [7], orientation: { 7: back0 } });
    s = run(catalog, s, { type: "useEffect", card: fk(7), effect: "e1", targets: [], option: null });
    expect(s.pending).toMatchObject({ kind: "discoverChoice", options: [fk(82), fk(83)] });
  });

  it("tous les effets à activer des cartes 1 à 10 sont automatisés", () => {
    const missing: string[] = [];
    for (let n = 1; n <= 10; n++) {
      const t = catalog.templates.get(fk(n));
      for (const [k, st] of Object.entries(t?.stages ?? {})) {
        for (const e of st?.effects ?? []) {
          if (!catalog.effects.has(`${fk(n)}/${k}/${e.id}`)) missing.push(`${n}/${k}/${e.id} ${e.text}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
