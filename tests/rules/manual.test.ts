import { describe, expect, it } from "vitest";
import { applyAction, canUndo, current, isLegal, newSession, act, checkKey, computeScore, type Action, type ManualOp } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, run } from "../helpers/game";

// Opérations « à la main » de la v0.17 : plus proposées (v0.18), mais encore rejouées pour les parties qui en contiennent.
describe("opérations à la main (rejeu des parties v0.17)", async () => {
  const catalog = await loadCatalog();
  const manual = (op: ManualOp): Action => ({ type: "manual", op });
  const back0 = { side: "back", rotation: 0 } as const;

  it("ajouter et retirer des ressources, jamais en dessous de zéro", () => {
    let s = arrange(catalog, { play: [1] });
    s = run(catalog, s, manual({ kind: "resource", resource: "coin", delta: 2 }), manual({ kind: "resource", resource: "coin", delta: -1 }));
    expect(s.resources.coin).toBe(1);
    expect(isLegal(catalog, s, manual({ kind: "resource", resource: "coin", delta: -2 }))).toBe(false);
    expect(isLegal(catalog, s, manual({ kind: "resource", resource: "nope", delta: 1 }))).toBe(false);
    expect(isLegal(catalog, s, manual({ kind: "resource", resource: "coin", delta: 0 }))).toBe(false);
  });

  it("déplacer une carte d'une zone à l'autre", () => {
    let s = arrange(catalog, { play: [1, 2], deck: [3, 4] });
    s = run(catalog, s, manual({ kind: "move", card: fk(1), to: "destroyed", position: "bottom" }));
    expect(s.zones.destroyed).toContain(fk(1));
    s = run(catalog, s, manual({ kind: "move", card: fk(2), to: "deck", position: "top" }));
    expect(s.zones.deck).toEqual([fk(2), fk(3), fk(4)]);
    s = run(catalog, s, manual({ kind: "move", card: fk(3), to: "deck", position: "bottom" }));
    expect(s.zones.deck).toEqual([fk(2), fk(4), fk(3)]);
    expect(isLegal(catalog, s, manual({ kind: "move", card: fk(1), to: "destroyed", position: "bottom" }))).toBe(false);
  });

  it("sortir une carte de la pioche ou de la boîte révèle une information", () => {
    const s = arrange(catalog, { play: [1], deck: [3, 4] });
    const after = run(catalog, s, manual({ kind: "move", card: fk(4), to: "play", position: "bottom" }));
    expect(after.revealCount).toBe(s.revealCount + 1);
    const back = run(catalog, s, manual({ kind: "move", card: fk(1), to: "discard", position: "bottom" }));
    expect(back.revealCount).toBe(s.revealCount);
  });

  it("réorienter une carte, seulement vers une orientation qui existe", () => {
    let s = arrange(catalog, { play: [1] });
    s = run(catalog, s, manual({ kind: "orient", card: fk(1), orientation: back0 }));
    expect(s.cards[fk(1)]?.orientation).toEqual(back0);
    expect(isLegal(catalog, s, manual({ kind: "orient", card: fk(1), orientation: back0 }))).toBe(false);
    const t = arrange(catalog, { play: [13] });
    expect(isLegal(catalog, t, manual({ kind: "orient", card: fk(13), orientation: { side: "front", rotation: 180 } }))).toBe(false);
    expect(isLegal(catalog, t, manual({ kind: "orient", card: fk(13), orientation: back0 }))).toBe(true);
  });

  it("découvrir une carte de la boîte par son numéro", () => {
    let s = arrange(catalog, { play: [1] });
    s = run(catalog, s, manual({ kind: "discover", card: fk(15) }));
    expect(s.zones.box).not.toContain(fk(15));
    expect(s.discoveries).toContain(15);
    expect(isLegal(catalog, s, manual({ kind: "discover", card: fk(15) }))).toBe(false);
    expect(isLegal(catalog, s, manual({ kind: "discover", card: fk(0) }))).toBe(false);
  });

  it("découvrir une carte à flèches rouges la pose côté recto, sans choix de face (décision du 2026-10-03)", () => {
    const s = run(catalog, arrange(catalog, { play: [1] }), manual({ kind: "discover", card: fk(13) }));
    expect(s.pending?.kind).not.toBe("chooseSide");
    expect(s.cards[fk(13)]?.orientation).toEqual({ side: "front", rotation: 0 });
    expect(s.zones.discard).toContain(fk(13));
  });

  it("cocher puis décocher une case du stage actif", () => {
    let s = arrange(catalog, { play: [25] });
    s = run(catalog, s, manual({ kind: "check", card: fk(25), box: "c1" }));
    expect(s.cards[fk(25)]?.checkedBoxes).toEqual([checkKey(1, "c1")]);
    s = run(catalog, s, manual({ kind: "check", card: fk(25), box: "c1" }));
    expect(s.cards[fk(25)]?.checkedBoxes).toEqual([]);
    expect(isLegal(catalog, s, manual({ kind: "check", card: fk(25), box: "zz" }))).toBe(false);
  });

  it("poser un sticker de ressource (produit) ou de gloire (compte au score)", () => {
    let s = arrange(catalog, { play: [1] });
    const before = computeScore(catalog, s).total;
    s = run(
      catalog,
      s,
      manual({ kind: "sticker", card: fk(1), sticker: "2", resource: "wood", fame: null }),
      manual({ kind: "sticker", card: fk(1), sticker: "8", resource: null, fame: 2 }),
    );
    expect(legal(catalog, s).some((a) => a.type === "produce" && a.card === fk(1))).toBe(true);
    expect(computeScore(catalog, s).total).toBe(before + 2);
    expect(isLegal(catalog, s, manual({ kind: "sticker", card: fk(1), sticker: "x", resource: "wood", fame: 2 }))).toBe(false);
  });

  it("un effet non automatisé n'est plus proposé, mais une partie qui l'a utilisé se rejoue", () => {
    const s = arrange(catalog, { play: [18, 1], orientation: { 18: { side: "front", rotation: 180 } } });
    expect(legal(catalog, s).some((a) => a.type === "manual")).toBe(false);
    const after = applyAction(catalog, s, manual({ kind: "effect", card: fk(18), effect: "e1" }));
    expect(after.zones.discard).toContain(fk(18));
  });

  it("les effets automatisés ne sont pas proposés à la main", () => {
    const s = arrange(catalog, { play: [10], resources: { coin: 1 } });
    expect(legal(catalog, s).some((a) => a.type === "manual")).toBe(false);
  });

  it("pas d'opération à la main pendant une décision ou après la partie", () => {
    const s = { ...arrange(catalog, { play: [1] }), phase: "gameOver" as const };
    expect(isLegal(catalog, s, manual({ kind: "resource", resource: "coin", delta: 1 }))).toBe(false);
  });

  it("les opérations à la main s'annulent en mode strict tant qu'elles ne révèlent rien", () => {
    let session = newSession(catalog, { expansion: "FeudalKingdom", seed: 3, undoMode: "strict" });
    session = act(session, manual({ kind: "resource", resource: "stone", delta: 1 }));
    expect(current(session).resources.stone).toBe(1);
    expect(canUndo(session)).toBe(true);
    const top = current(session).zones.deck[0];
    if (top) {
      session = act(session, manual({ kind: "move", card: top, to: "play", position: "bottom" }));
      expect(canUndo(session)).toBe(false);
    }
  });
});
