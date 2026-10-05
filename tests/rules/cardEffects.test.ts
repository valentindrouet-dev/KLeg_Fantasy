import { describe, expect, it } from "vitest";
import { cardBadges, cardName, computeScore, exhaustedEffects, isLegal, getLegalActions, isEffectExhausted, productionGroups, refreshPendingPrompt, type Action, type Answer, type GameState } from "../../src/engine";
import { canPay } from "../../src/engine/state";
import { checkKey } from "../../src/engine/ops";
import { payPool, restrictionSources } from "../../src/engine/passives";
import { planWithEngaged } from "../../src/engine/payment";
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
    const s = arrange(catalog, { play: [44, 1], deck: [2], orientation: { 44: { side: "back", rotation: 0 } } });
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
    // Pas de Oui/Non : on touche directement la carte à garder, ou le bouton qui refuse.
    expect(pending(s)?.request).toEqual({
      type: "cards",
      prompt: "Shrine se défausse : 1 carte à garder en jeu",
      options: [fk(1)],
      min: 1,
      max: 1,
      none: "Je ne veux rien garder",
    });
    s = run(catalog, s, choose({ cards: [fk(1)] }));
    expect(s.zones.play).toContain(fk(1));
    expect(s.zones.discard).toContain(fk(82));
  });

  it("Sanctuary : jusqu'à 2 cartes gardées, une seule suffit", () => {
    let s = arrange(catalog, { play: [82, 1, 3], deck: [2, 4, 5, 6], orientation: { 82: { side: "front", rotation: 180 } } });
    s = run(catalog, s, { type: "pass" });
    expect(pending(s)?.request).toMatchObject({ type: "cards", prompt: "Sanctuary se défausse : jusqu'à 2 cartes à garder en jeu", min: 1, max: 2 });
    s = run(catalog, s, choose({ cards: [fk(3)] }));
    expect(s.zones.play).toContain(fk(3));
    expect(s.zones.discard).toEqual(expect.arrayContaining([fk(1), fk(82)]));
  });

  it("un effet « stay in play » refusé (réponse vide) ne fait rien", () => {
    let s = arrange(catalog, { play: [82, 1], deck: [2, 3, 4, 5] });
    s = run(catalog, s, { type: "pass" }, choose({ cards: [] }));
    expect(s.zones.discard).toEqual(expect.arrayContaining([fk(1), fk(82)]));
  });

  it("parties enregistrées avec la question Oui/Non : toujours rejouées", () => {
    let s = arrange(catalog, { play: [82, 1], deck: [2, 3, 4, 5] });
    s = run(catalog, s, { type: "pass" }, choose({ option: 0 }), choose({ cards: [fk(1)] }));
    expect(s.zones.play).toContain(fk(1));
    expect(s.zones.discard).toContain(fk(82));
    s = arrange(catalog, { play: [82, 1], deck: [2, 3, 4, 5] });
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

  it("parchemin 24 : Fertile Soil propose les terres, puis Efficiency les bâtiments (Food Barns au stage 4 compris)", () => {
    let s = arrange(catalog, { play: [2], discard: [1, 3, 9], orientation: { 1: { side: "back", rotation: 0 } } });
    s.zones.box = s.zones.box.filter((id) => (s.cards[id]?.serial ?? 0) >= 24 || s.cards[id]?.serial === 0);
    s = run(catalog, s, { type: "pass" }, { type: "acknowledgeParchment" });
    expect(pending(s)?.request).toMatchObject({ type: "cards", options: [fk(3), fk(2)] }); // terres : Wild Grass 02, 03
    s = run(catalog, s, choose({ cards: [fk(2)] }));
    expect(pending(s)?.request).toMatchObject({ type: "cards", options: [fk(1), fk(9)] }); // bâtiments : Food Barns, Headquarters
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

  it("Stranger : on lui donne un nom (geste libre, enregistré), qui remplace le blanc du titre ; compteur de passages", () => {
    let s = arrange(catalog, { play: [92, 1], deck: [2] });
    s.cards[fk(92)] = { ...s.cards[fk(92)]!, plays: 1 };
    expect(cardBadges(catalog, s, fk(92))).toEqual(["1er passage", "✎ à nommer"]);
    s = run(catalog, s, { type: "manual", op: { kind: "name", card: fk(92), name: "  Mirabelle " } });
    expect(cardName(catalog, s, fk(92))).toBe("Mirabelle (#92)");
    expect(cardBadges(catalog, s, fk(92))).toEqual(["1er passage"]);
    expect(isLegal(catalog, s, { type: "manual", op: { kind: "name", card: fk(1), name: "Bob" } })).toBe(false);
    expect(isLegal(catalog, s, { type: "manual", op: { kind: "name", card: fk(92), name: " " } })).toBe(false);
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

  it("Export, case à 20 : la question dit l'effet (sticker 7, sur une personne) ; une question enregistrée avant est reformulée", () => {
    let s = arrange(catalog, { play: [1], discard: [13, 103], permanent: [27], resources: { tradeGood: 20 } });
    s = run(catalog, s, { type: "pass" }, choose({ option: 0 }));
    // Deux cases atteintes (10 et 20) : la case à 20.
    s = run(catalog, s, choose({ option: 1 }));
    expect(pending(s)?.request).toMatchObject({ type: "cards", prompt: "Export 20 {tradeGood} · Sticker 7 (Stays in play) : sur quelle personne ?" });
    // Partie enregistrée avec l'ancien libellé : il est remplacé au chargement, la question reste la même.
    const old = structuredClone(s);
    if (old.pending?.kind === "choice") old.pending.request = { ...old.pending.request, prompt: "Sur quelle carte ?" };
    expect(refreshPendingPrompt(catalog, old).pending).toEqual(s.pending);
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
    expect(exhaustedEffects(catalog, s, fk(17), 2)).toEqual([{ id: "e1", index: 0, count: 1 }]);
  });

  it("un effet à usage unique utilisé, une piste complète : épuisés ; Army avant la fin : non", () => {
    const s = arrange(catalog, { play: [1], permanent: [25] });
    s.cards[fk(25)]!.checkedBoxes = ["1/c1"];
    expect(exhaustedEffects(catalog, s, fk(25), 1)).toEqual([]);
    s.cards[fk(25)]!.checkedBoxes = Array.from({ length: 10 }, (_, i) => `1/c${i + 1}`);
    expect(exhaustedEffects(catalog, s, fk(25), 1)).toEqual([{ id: "e1", index: 0, count: 1 }]);
  });

  it("Dark Prince et Rain : les cartes qui interdisent d'avancer, d'améliorer, les effets {time}", () => {
    const s = arrange(catalog, { play: [61, 44, 1], orientation: { 44: { side: "back", rotation: 0 } } });
    expect(restrictionSources(catalog, s)).toEqual({ advance: [fk(61), fk(44)], upgrade: [fk(61)], time: [fk(61)] });
    expect(legal(catalog, s).some((a) => a.type === "advance")).toBe(false);
  });

  it("une carte découverte par un effet est présentée (Magistrate → Border 130), puis le tour continue", () => {
    let s = arrange(catalog, { play: [51, 1], deck: [2, 3, 4, 5] });
    s = run(catalog, s, { type: "useEffect", card: fk(51), effect: "e1", targets: [], option: null });
    expect(s.pending).toEqual({ kind: "newCards", cards: [fk(130)] });
    expect(s.zones.discard).toContain(fk(130));
    const turn = s.turn;
    s = run(catalog, s, { type: "acknowledgeDiscoveries" });
    expect(s.pending).toBeNull();
    expect(s.turn).toBe(turn + 1); // effet {time} : le tour se termine après la présentation
  });

  it("une carte choisie dans la fenêtre de découverte n'est pas présentée une seconde fois", () => {
    // Shallow Mine : « Discover Mine (84 / 85). »
    let s = arrange(catalog, { play: [5, 1], orientation: { 5: { side: "back", rotation: 0 } }, deck: [2, 3, 4] });
    s = run(catalog, s, { type: "useEffect", card: fk(5), effect: "e1", targets: [], option: null });
    expect(s.pending?.kind).toBe("discoverChoice");
    s = run(catalog, s, { type: "chooseDiscovery", card: fk(84) });
    expect(s.pending?.kind).not.toBe("newCards");
    expect(s.zones.discard).toContain(fk(84));
  });

  it("Brick Road : une fois 109 et 110 sorties de la boîte, l'effet est épuisé, barré et plus proposé", () => {
    const s = arrange(catalog, { play: [43, 1], orientation: { 43: { side: "back", rotation: 0 } }, deck: [2, 3] });
    expect(legal(catalog, s).some((a) => a.type === "useEffect" && a.card === fk(43))).toBe(true);
    s.zones.box = s.zones.box.filter((id) => id !== fk(109) && id !== fk(110));
    s.zones.destroyed.push(fk(109));
    s.zones.discard.push(fk(110));
    expect(legal(catalog, s).some((a) => a.type === "useEffect" && a.card === fk(43))).toBe(false);
    expect(exhaustedEffects(catalog, s, fk(43), 4)).toEqual([{ id: "e1", index: 0, count: 1 }]);
  });

  it("même pouvoir sur deux cartes (Shallow Mine 05 et 06) : utiliser l'une n'épuise pas l'autre tant qu'une Mine reste à découvrir", () => {
    const back = { side: "back", rotation: 0 } as const;
    const useMine = (n: number): Action => ({ type: "useEffect", card: fk(n), effect: "e1", targets: [], option: null });
    let s = arrange(catalog, { play: [5, 6, 1], orientation: { 5: back, 6: back }, deck: [2, 3] });
    s = run(catalog, s, useMine(5), { type: "chooseDiscovery", card: fk(84) });
    expect(s.zones.box).toContain(fk(85));
    expect(exhaustedEffects(catalog, s, fk(6), 4)).toEqual([]);
    expect(legal(catalog, s)).toContainEqual(useMine(6));
    s = run(catalog, s, useMine(6), { type: "acknowledgeDiscoveries" });
    expect(s.zones.discard).toEqual(expect.arrayContaining([fk(84), fk(85)]));
    // Les deux Mines sorties : le même pouvoir, sur une troisième copie (15), est épuisé.
    const t = arrange(catalog, { play: [15, 1], orientation: { 15: back } });
    t.zones.box = t.zones.box.filter((id) => id !== fk(84) && id !== fk(85));
    expect(exhaustedEffects(catalog, t, fk(15), 4)).toEqual([{ id: "e1", index: 0, count: 1 }]);
  });

  it("deux cartes qui gardent d'autres cartes en jeu : sans ennemi ni carte déjà gardée, et le tour suivant commence normalement", () => {
    const sanctuary = { side: "front", rotation: 180 } as const;
    let s = arrange(catalog, { play: [82, 83, 1, 2, 56], deck: [3, 4, 5, 6, 7, 8, 9, 10], orientation: { 82: sanctuary, 56: { side: "back", rotation: 0 } } });
    const pick = (answer: Answer): Action => ({ type: "choose", answer });
    s = run(catalog, s, { type: "pass" }, pick({ option: 0 }));
    // Sanctuary : ni l'ennemi (Enemy Soldier), ni elle-même.
    expect(s.pending?.kind === "choice" && s.pending.request).toMatchObject({ type: "cards", options: [fk(83), fk(1), fk(2)] });
    s = run(catalog, s, pick({ cards: [fk(1), fk(2)] }));
    // Shrine : les cartes déjà gardées ne sont plus proposées ; il ne reste rien à garder, pas de question.
    expect(s.pending).toBeNull();
    expect(s.turn).toBe(2);
    expect(s.zones.play).toEqual(expect.arrayContaining([fk(1), fk(2)]));
    expect(s.zones.play).toHaveLength(7); // 1, 2, Enemy Soldier (Stays in play) et 4 nouvelles cartes
  });

  it("toucher une case : c'est la case touchée qui est cochée et qui donne son bonus (Merchant), même entre cases identiques (Astronomer)", () => {
    const merchant = { side: "back", rotation: 0 } as const;
    const mark: Action = { type: "useEffect", card: fk(41), effect: "e1", targets: [], option: null };
    let s = arrange(catalog, { play: [41, 1], orientation: { 41: merchant }, deck: [2, 3] });
    s = run(catalog, s, mark);
    expect(s.pending?.kind === "choice" && s.pending.request.type === "option" && s.pending.request.boxes).toHaveLength(24);
    s = run(catalog, s, { type: "choose", answer: { box: "c12" } }, { type: "choose", answer: { box: "c21" } });
    expect(s.cards[fk(41)]?.checkedBoxes).toEqual(["4/c12", "4/c21"]);
    expect(s.resources).toMatchObject({ wood: 1, stone: 1 });
    // Astronomer : 16 cases identiques, la question est posée (pas de réponse d'office).
    let t = arrange(catalog, { play: [95, 1], deck: [2, 3], resources: { coin: 2 } });
    t = run(catalog, t, { type: "useEffect", card: fk(95), effect: "e1", targets: [], option: null }, { type: "choose", answer: { box: "c9" } });
    expect(t.cards[fk(95)]?.checkedBoxes).toEqual(["1/c9"]);
  });

  it("Priest : on vise la carte à améliorer ; 2 {coin} + le coût de l'amélioration, payables avec des cartes engagées ; le tour continue", () => {
    const s = arrange(catalog, { play: [104, 1, 2, 3], deck: [4, 5, 6], resources: { coin: 2 } });
    const options = legal(catalog, arrange(catalog, { play: [104, 1, 2, 3], resources: { coin: 9 } })).filter((a) => a.type === "useEffect" && a.card === fk(104));
    expect(options.map((a) => (a.type === "useEffect" ? a.targets : []))).toEqual([[fk(1)], [fk(2)], [fk(3)]]);
    // 2 {coin} en réserve ne suffisent pas pour 2 + 2 : les Wild Grass 2 et 3 produisent pour améliorer la 1.
    const action: Action = { type: "useEffect", card: fk(104), effect: "e1", targets: [fk(1)], option: 0 };
    const plan = planWithEngaged(catalog, s, action, [fk(2), fk(3)]);
    expect(plan).not.toBeNull();
    const after = run(catalog, s, ...(plan ?? []));
    expect(after.cards[fk(1)]?.orientation).toEqual({ side: "front", rotation: 180 });
    expect(after.turn).toBe(1);
    expect(after.pending).toBeNull();
  });

  it("Priest : une partie enregistrée avec l'ancienne forme (effet sans cible, puis menu) se rejoue", () => {
    let s = arrange(catalog, { play: [104, 1, 2], deck: [4, 5, 6], resources: { coin: 4 } });
    s = run(catalog, s, { type: "useEffect", card: fk(104), effect: "e1", targets: [], option: null }, { type: "choose", answer: { option: 0 } });
    expect(s.cards[fk(1)]?.orientation).toEqual({ side: "front", rotation: 180 });
    expect(s.resources.coin).toBe(0);
  });

  it("Royal Visit : on touche l'icône du coût à rayer sur la carte visée", () => {
    let s = arrange(catalog, { play: [70, 9, 1], deck: [2, 3] });
    s = run(catalog, s, { type: "useEffect", card: fk(70), effect: "e1", targets: [], option: null }, { type: "choose", answer: { cards: [fk(9)] } });
    const req = s.pending?.kind === "choice" ? s.pending.request : null;
    expect(req).toMatchObject({ type: "option", card: fk(9), spots: "cost", boxes: ["1/u1/0", "1/u1/1", "1/u1/2", "1/u1/3"] });
    s = run(catalog, s, { type: "choose", answer: { box: "1/u1/1" } });
    expect(s.cards[fk(9)]?.crossedOutCosts).toEqual(["1/u1/1"]);
  });

  it("Engineer : chaque option de la liste se barre quand sa carte a quitté la boîte, et n'est plus proposée", () => {
    const s = arrange(catalog, { play: [33, 11], deck: [2, 3] });
    const lumberjack = s.zones.play.find((id) => id === fk(11));
    expect(lumberjack).toBeDefined();
    s.zones.box = s.zones.box.filter((id) => id !== fk(100));
    s.zones.discard.push(fk(100));
    expect(exhaustedEffects(catalog, s, fk(33), 1)).toEqual([{ id: "e1", index: 0, count: 1, options: { done: [0], count: 3 } }]);
    s.zones.box = s.zones.box.filter((id) => id !== fk(101) && id !== fk(102));
    expect(exhaustedEffects(catalog, s, fk(33), 1)).toEqual([{ id: "e1", index: 0, count: 1 }]);
  });

  it("Servant : son gain au choix sert comme une production engagée (pas de question) ; l'ancienne forme se rejoue", () => {
    const servant = { side: "back", rotation: 0 } as const;
    const s = arrange(catalog, { play: [13, 1, 2], orientation: { 13: servant }, deck: [3, 4], resources: { coin: 1 } });
    // Wild Grass (1) : amélioration à 2 {coin} ; 1 en réserve + le Servant engagé.
    const up: Action = { type: "upgrade", card: fk(1), upgrade: "u1", discard: [] };
    const plan = planWithEngaged(catalog, s, up, [fk(13)]);
    expect(plan?.[0]).toEqual({ type: "useEffect", card: fk(13), effect: "e1", targets: [], option: 0 });
    const after = run(catalog, s, ...(plan ?? []));
    expect(after.cards[fk(1)]?.orientation).toEqual({ side: "front", rotation: 180 });
    expect(after.zones.discard).toContain(fk(13));
    // Partie enregistrée avant : l'effet, puis la réponse à « Quelle ressource ? ».
    const old = run(catalog, s, { type: "useEffect", card: fk(13), effect: "e1", targets: [], option: null }, { type: "choose", answer: { option: 2 } });
    expect(old.resources.stone).toBe(1);
  });

  it("Bazaar : l'échange s'engage comme une production ; payé avec l'or d'une autre carte engagée", () => {
    const bazaar = { side: "front", rotation: 180 } as const;
    const s = arrange(catalog, { play: [10, 9, 1], orientation: { 10: bazaar }, deck: [3, 4], resources: { stone: 3 } });
    // Headquarters (9) : amélioration {stone}{wood}{stone}{stone}. Le bois vient du Bazaar, son {coin} de Wild Grass.
    const up: Action = { type: "upgrade", card: fk(9), upgrade: "u1", discard: [] };
    const plan = planWithEngaged(catalog, s, up, [fk(10), fk(1)]);
    expect(plan?.map((a) => a.type)).toEqual(["produce", "useEffect", "upgrade"]);
    const after = run(catalog, s, ...(plan ?? []));
    expect(after.cards[fk(9)]?.orientation).toEqual({ side: "front", rotation: 180 });
    // Sans or pour l'échange, pas de plan.
    expect(planWithEngaged(catalog, s, up, [fk(10)])).toBeNull();
  });
});
