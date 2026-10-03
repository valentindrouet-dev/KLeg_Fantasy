import { describe, expect, it } from "vitest";
import { computeScore, exhaustedEffects, getLegalActions, isEffectExhausted, productionGroups, type Action, type Answer, type GameState } from "../../src/engine";
import { canPay } from "../../src/engine/state";
import { checkKey } from "../../src/engine/ops";
import { payPool } from "../../src/engine/passives";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, run } from "../helpers/game";

// Effets des cartes 11 à 135 (phase P3) : une mécanique par test.
describe("effets des cartes", async () => {
  const catalog = await loadCatalog();
  const front180 = { side: "front", rotation: 180 } as const;
  const back0 = { side: "back", rotation: 0 } as const;
  const back180 = { side: "back", rotation: 180 } as const;
  const choose = (answer: Answer): Action => ({ type: "choose", answer });
  const use = (n: number, effect = "e1"): Action => ({ type: "useEffect", card: fk(n), effect, targets: [], option: null });
  const pending = (s: GameState) => (s.pending?.kind === "choice" ? s.pending : null);

  it("Bandit bloque une carte qui produit des pièces ; vaincu, il la libère", () => {
    let s = arrange(catalog, { play: [1, 7], deck: [14, 2, 3, 4, 5] });
    s = run(catalog, s, { type: "advance" }); // joue Bandit (14) et 2
    // Deux cartes produisent des pièces (1 et 2) : le joueur choisit.
    expect(pending(s)?.request.type).toBe("cards");
    s = run(catalog, s, choose({ cards: [fk(1)] }));
    expect(s.zones.play).not.toContain(fk(1));
    expect(s.zones.blocked).toEqual([fk(1)]);
    // Vaincre le Bandit : 1 épée, puis 2 ressources au choix.
    s.resources.sword = 1;
    s = run(catalog, s, use(14, "e2"), choose({ resources: ["wood", "stone"] }));
    expect(s.zones.destroyed).toContain(fk(14));
    expect(s.zones.play).toContain(fk(1));
    expect(s.resources).toMatchObject({ wood: 1, stone: 1, sword: 0 });
  });

  it("une carte bloquée part à la défausse avec sa bloquante en fin de tour", () => {
    let s = arrange(catalog, { play: [7], deck: [14, 2, 3, 4, 5] });
    s = run(catalog, s, { type: "advance" });
    expect(s.zones.blocked).toEqual([fk(2)]); // seule carte à pièces : pas de question
    s = run(catalog, s, { type: "pass" });
    expect(s.zones.blocked).toEqual([]);
    expect(s.zones.discard).toEqual(expect.arrayContaining([fk(2), fk(14)]));
  });

  it("Enemy Soldier reste en jeu avec la carte bloquée, puis la détruit en fin de manche", () => {
    let s = arrange(catalog, { play: [7], deck: [56, 9], orientation: { 56: back0 } });
    s = run(catalog, s, { type: "advance" });
    s = run(catalog, s, choose({ cards: [fk(7)] }));
    expect(s.zones.blocked).toEqual([fk(7)]);
    s = run(catalog, s, { type: "pass" }); // deck vide : fin de manche
    expect(s.zones.destroyed).toContain(fk(7));
  });

  it("Field Worker gagne la production d'une terre sans la défausser", () => {
    let s = arrange(catalog, { play: [13, 5, 1], orientation: { 5: front180 } });
    s = run(catalog, s, use(13), choose({ cards: [fk(5)] }));
    expect(s.resources.stone).toBe(1);
    expect(s.zones.play).toContain(fk(5));
    expect(s.zones.discard).toEqual([fk(13)]);
  });

  it("choisir des ressources, puis tourner la carte (Investor)", () => {
    let s = arrange(catalog, { play: [120, 1] });
    s = run(catalog, s, use(120));
    expect(pending(s)?.request).toMatchObject({ type: "resources", count: 3 });
    s = run(catalog, s, choose({ resources: ["metal", "metal", "sword"] }));
    expect(s.resources).toMatchObject({ metal: 2, sword: 1 });
    expect(s.cards[fk(120)]?.orientation).toEqual(front180);
    expect(s.zones.discard).toEqual([fk(120)]);
  });

  it("un effet lancé peut être annulé tant que rien n'est choisi", () => {
    let s = arrange(catalog, { play: [120, 1] });
    s = run(catalog, s, use(120), { type: "cancelChoice" });
    expect(s.pending).toBeNull();
    expect(s.zones.play).toContain(fk(120));
  });

  it("Army : payer la case suivante, cocher, fin du tour ; gloire = plus haute case cochée", () => {
    let s = arrange(catalog, { play: [1], permanent: [25], deck: [2, 3, 4, 5], resources: { sword: 3 } });
    expect(legal(catalog, s).some((a) => a.type === "useEffect" && a.card === fk(25))).toBe(true);
    s = run(catalog, s, use(25));
    expect(s.cards[fk(25)]?.checkedBoxes).toEqual([checkKey(1, "c1")]);
    expect(s.zones.permanent).toContain(fk(25));
    expect(s.turn).toBe(2);
    expect(computeScore(catalog, s).lines.find((l) => l.card === fk(25))?.fame).toBe(1);
  });

  it("Thunderstorm défausse 3 cartes du deck puis devient Rain", () => {
    let s = arrange(catalog, { play: [1], deck: [44, 2, 3, 4, 5, 6] });
    s = run(catalog, s, { type: "advance" });
    expect(s.zones.discard).toEqual(expect.arrayContaining([fk(3), fk(4), fk(5), fk(44)]));
    expect(s.cards[fk(44)]?.orientation).toEqual(back0);
  });

  it("Rain : interdit d'avancer, les terres produisent 2 pièces de plus", () => {
    const s = arrange(catalog, { play: [44, 1], deck: [2], orientation: { 44: back0 } });
    expect(legal(catalog, s).some((a) => a.type === "advance")).toBe(false);
    expect(productionGroups(catalog, s, fk(1)).flatMap((g) => g.options[0] ?? [])).toEqual(["coin", "coin", "coin"]);
  });

  it("Dark Knight : ni avancer, ni améliorer, ni effet de temps", () => {
    const s = arrange(catalog, { play: [45, 1], permanent: [25], deck: [2], resources: { coin: 5, sword: 1 } });
    const types = legal(catalog, s).map((a) => a.type);
    expect(types).not.toContain("advance");
    expect(types).not.toContain("upgrade");
    expect(legal(catalog, s).some((a) => a.type === "useEffect" && a.card === fk(25))).toBe(false);
  });

  it("Pirate : 1 pièce de moins à chaque production", () => {
    const s = arrange(catalog, { play: [76, 1, 5], orientation: { 1: { side: "front", rotation: 180 } } });
    expect(productionGroups(catalog, s, fk(1))).toEqual([]);
    expect(productionGroups(catalog, s, fk(5)).length).toBe(0);
  });

  it("Wood Shipment : bois et marchandises s'échangent pour payer", () => {
    const s = arrange(catalog, { play: [100], orientation: { 100: back180 }, resources: { tradeGood: 2 } });
    expect(canPay(s, ["wood", "wood"], payPool(catalog, s))).toBe(true);
  });

  it("Cardinal améliore une carte en jeu sans finir le tour", () => {
    let s = arrange(catalog, { play: [104, 1], deck: [2], orientation: { 104: back0 }, resources: { coin: 2 } });
    s = run(catalog, s, use(104));
    expect(s.cards[fk(1)]?.orientation).toEqual(front180);
    expect(s.zones.discard).toEqual(expect.arrayContaining([fk(1), fk(104)]));
    expect(s.turn).toBe(1);
    expect(s.resources.coin).toBe(0);
  });

  it("Manor : après chaque production, une pièce est rayée", () => {
    let s = arrange(catalog, { play: [111] });
    s = run(catalog, s, { type: "produce", card: fk(111), choices: [0] });
    expect(s.resources.coin).toBe(6);
    expect(productionGroups(catalog, s, fk(111))[0]?.options[0]?.length).toBe(5);
  });

  it("Shrine : se défausser pour garder une autre carte en jeu", () => {
    let s = arrange(catalog, { play: [82, 1], deck: [2, 3, 4, 5] });
    s = run(catalog, s, { type: "pass" });
    expect(pending(s)?.request).toMatchObject({ type: "option", labels: ["Oui", "Non"] });
    s = run(catalog, s, choose({ option: 0 }));
    expect(s.zones.play).toContain(fk(1));
    expect(s.zones.discard).toContain(fk(82));
  });

  it("un effet optionnel refusé ne fait rien", () => {
    let s = arrange(catalog, { play: [82, 1], deck: [2, 3, 4, 5] });
    s = run(catalog, s, { type: "pass" }, choose({ option: 1 }));
    expect(s.zones.discard).toEqual(expect.arrayContaining([fk(1), fk(82)]));
  });

  it("parchemin 24 : sticker 1 sur une terre et +1 sur un bâtiment", () => {
    let s = arrange(catalog, { play: [1], discard: [9] });
    s.zones.box = s.zones.box.filter((id) => (s.cards[id]?.serial ?? 0) >= 24 || s.cards[id]?.serial === 0);
    s = run(catalog, s, { type: "pass" }, { type: "acknowledgeParchment" });
    // Fertile Soil : la seule terre (1) reçoit le sticker d'office ; Efficiency : le seul bâtiment (9).
    expect(s.cards[fk(1)]?.stickers).toEqual([{ sticker: "1", stage: 1, resource: "coin" }]);
    expect(s.cards[fk(9)]?.stickers).toEqual([{ sticker: "1", stage: 1, resource: "coin" }]);
  });

  it("Volcanic Eruption détruit la prochaine terre jouée, puis se retourne", () => {
    let s = arrange(catalog, { play: [28], deck: [1, 9] });
    s = run(catalog, s, { type: "advance" });
    expect(s.zones.destroyed).toEqual([fk(1)]);
    expect(s.cards[fk(28)]?.orientation).toEqual(back0);
  });

  it("Stranger : au 2e passage en jeu, un sticker au choix", () => {
    let s = arrange(catalog, { play: [1], deck: [92] });
    s.cards[fk(92)] = { ...s.cards[fk(92)]!, plays: 1 };
    s = run(catalog, s, { type: "advance" });
    expect(pending(s)?.request.type).toBe("option");
    s = run(catalog, s, choose({ option: 1 }));
    expect(s.cards[fk(92)]?.stickers).toEqual([{ sticker: "10", stage: 1, fame: 5 }]);
  });

  it("Impregnable Fortress peut défausser 2 murs à sa place", () => {
    let s = arrange(catalog, { play: [123, 18, 63], orientation: { 123: back0, 18: back0, 63: back0 } });
    s = run(catalog, s, { type: "produce", card: fk(123), choices: [0] });
    expect(s.resources.sword).toBe(3);
    s = run(catalog, s, choose({ option: 0 }));
    expect(s.zones.play).toEqual([fk(123)]);
    expect(s.zones.discard).toEqual(expect.arrayContaining([fk(18), fk(63)]));
  });

  it("Strength in Numbers : 2 gloire par personne du royaume", () => {
    const s = arrange(catalog, { permanent: [38], discard: [10, 13, 1] });
    expect(computeScore(catalog, s).lines.find((l) => l.card === fk(38))?.fame).toBe(4);
  });

  it("Export : les marchandises restantes y sont dépensées en fin de tour, puis une case est utilisée entre deux manches", () => {
    let s = arrange(catalog, { play: [1], permanent: [27], resources: { tradeGood: 10 } });
    s = run(catalog, s, { type: "pass" });
    expect(s.cards[fk(27)]?.tallies).toEqual({ "1": 10 });
    // Fin de manche (deck vide) : la case à 10 est atteinte.
    expect(pending(s)?.request).toMatchObject({ type: "option", labels: ["Oui", "Non"] });
    s = run(catalog, s, choose({ option: 0 }), choose({ option: 1 }));
    expect(s.cards[fk(1)]?.stickers).toEqual([{ sticker: "2", stage: 1, resource: "wood" }]);
    expect(s.cards[fk(27)]?.checkedBoxes).toEqual([checkKey(1, "c1")]);
  });

  it("toutes les réponses énumérées sont légales", () => {
    let s = arrange(catalog, { play: [120, 1] });
    s = run(catalog, s, use(120));
    for (const a of getLegalActions(catalog, s)) expect(() => run(catalog, s, a)).not.toThrow();
  });

  it("Merchant : choisir librement les cases à cocher (2 au plus)", () => {
    let s = arrange(catalog, { play: [41, 1], orientation: { 41: back0 } });
    s = run(catalog, s, use(41));
    const first = pending(s)?.request;
    expect(first).toMatchObject({ type: "option", labels: ["+{coin}", "+{wood}", "+{stone}", "+{metal}"] });
    s = run(catalog, s, choose({ option: 3 }), choose({ option: 2 }));
    expect(s.resources).toMatchObject({ metal: 1, stone: 1, coin: 0 });
    expect(s.cards[fk(41)]?.checkedBoxes).toEqual([checkKey(4, "c7"), checkKey(4, "c5")]);
  });
});

describe("effets épuisés", async () => {
  const catalog = await loadCatalog();
  it("une découverte dont la carte a quitté la boîte n'est plus proposée", () => {
    // Chapel (17 au stage 2) : « Spend {coin}{coin}{coin} to discover Missionary (103). »
    const s = arrange(catalog, { play: [17], orientation: { 17: { side: "front", rotation: 180 } }, resources: { coin: 3 } });
    expect(isEffectExhausted(catalog, s, fk(17), 2, catalog.templates.get(fk(17))!.stages["2"]!.effects[0]!)).toBe(false);
    s.zones.box = s.zones.box.filter((id) => id !== fk(103));
    s.zones.discard.push(fk(103));
    expect(getLegalActions(catalog, s).some((a) => a.type === "useEffect")).toBe(false);
    expect(exhaustedEffects(catalog, s, fk(17), 2)).toEqual([{ index: 0, count: 1 }]);
  });

  it("un effet à usage unique utilisé, une piste complète : épuisés ; Army avant la fin : non", () => {
    const s = arrange(catalog, { play: [1], permanent: [25] });
    s.cards[fk(25)]!.checkedBoxes = ["1/c1"];
    expect(exhaustedEffects(catalog, s, fk(25), 1)).toEqual([]);
    s.cards[fk(25)]!.checkedBoxes = Array.from({ length: 10 }, (_, i) => `1/c${i + 1}`);
    expect(exhaustedEffects(catalog, s, fk(25), 1)).toEqual([{ index: 0, count: 1 }]);
  });
});
