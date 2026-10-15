import { describe, expect, it } from "vitest";
import { cardId } from "../../src/data/schema";
import { applyAction, cardFame, getLegalActions, productionGroups, type Action, type GameState, type InstanceId } from "../../src/engine";
import { loadCatalog } from "../helpers/catalog";
import { arrange, fk, legal, run } from "../helpers/game";

// Extension Feudal Kingdom Adventures (cartes 00 à 28) : lancement, carte des aventures, tourment, protections,
// stickers de Merlin, effets particuliers.
describe("extension Adventures", async () => {
  const catalog = await loadCatalog();
  const adv = (n: number): InstanceId => cardId("FK_Adventures", n);

  const withAdv = (s: GameState): GameState => {
    for (const t of catalog.templates.values()) {
      if (t.expansion !== "FK_Adventures" || s.cards[t.id]) continue;
      s.cards[t.id] = { instanceId: t.id, templateId: t.id, serial: t.serial, orientation: { side: "front", rotation: 0 }, stickers: [], checkedBoxes: [], crossedOutEffects: [], crossedOutProduction: [] };
      s.zones.box.push(t.id);
    }
    return s;
  };
  const place = (s: GameState, zone: "play" | "deck" | "discard" | "permanent", ...serials: number[]): GameState => {
    for (const n of serials) {
      s.zones.box = s.zones.box.filter((id) => id !== adv(n));
      s.zones[zone].push(adv(n));
    }
    return s;
  };
  const orient = (s: GameState, n: number, side: "front" | "back", rotation: 0 | 180 = 0): GameState => {
    const c = s.cards[adv(n)];
    if (c) c.orientation = { side, rotation };
    return s;
  };
  const choice = (s: GameState) => (s.pending?.kind === "choice" ? s.pending : null);
  const use = (s: GameState, card: InstanceId, effect = "e1"): GameState => {
    const a = legal(catalog, s).find((x) => x.type === "useEffect" && x.card === card && x.effect === effect);
    expect(a, `effet ${effect} de ${card}`).toBeDefined();
    return run(catalog, s, a as Action);
  };
  const pick = (s: GameState, ...cards: InstanceId[]): GameState => run(catalog, s, { type: "choose", answer: { cards } });
  const option = (s: GameState, n: number): GameState => run(catalog, s, { type: "choose", answer: { option: n } });

  function autoplay(s: GameState, done: (s: GameState) => boolean, max = 3000): GameState {
    let st = s;
    for (let i = 0; i < max && !done(st); i++) {
      const p = st.pending;
      let a: Action | undefined;
      if (p?.kind === "choice" && p.request.type === "cards") a = { type: "choose", answer: { cards: p.request.options.slice(0, p.request.min) } };
      else if (p?.kind === "choice" && p.request.type === "option") a = { type: "choose", answer: { option: 0 } };
      else if (p) a = getLegalActions(catalog, st).find((x) => x.type !== "cancelChoice");
      else a = getLegalActions(catalog, st).find((x) => x.type === "pass");
      if (!a) break;
      st = applyAction(catalog, st, a);
    }
    return st;
  }

  const finished = (): GameState => {
    const s = arrange(catalog, { deck: Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => ![23, 24, 25, 26, 27, 30].includes(n)), permanent: [25, 26] });
    s.phase = "gameOver";
    return s;
  };

  it("lancement : purge 10 et 1 permanente, puis 01 et 02 découvertes ; la carte des aventures propose ses lieux", () => {
    let s = run(catalog, finished(), { type: "startGrandExpansion", expansion: "FK_Adventures" });
    expect(s.pending).toEqual({ kind: "parchment", card: adv(0) });
    s = run(catalog, s, { type: "acknowledgeParchment" });
    // 24 cartes : 2 paquets de 10, puis 1 permanente.
    expect(choice(s)?.request.prompt).toBe("Purge : 1 carte à purger (paquet 1/2)");
    while ((choice(s)?.request.prompt ?? "").startsWith("Purge") || (choice(s)?.request.prompt ?? "").startsWith("Carte permanente")) {
      const r = choice(s)?.request;
      s = pick(s, r?.type === "cards" ? (r.options[0] ?? "") : "");
    }
    expect(s.zones.purged).toHaveLength(3);
    expect(s.pending).toEqual({ kind: "newCards", cards: [adv(1), adv(2)] });
    expect(s.zones.permanent).toContain(adv(1));
    s = run(catalog, s, { type: "acknowledgeDiscoveries" });
    // Début de manche, la première comprise : cocher un lieu (ou aucun).
    expect(choice(s)?.request).toMatchObject({
      type: "option",
      labels: ["Découvrir The Pixies (07)", "Découvrir Fountain of Youth (08)", "Découvrir Free the Village (09)", "Découvrir Siren's Cave (10)", "Découvrir Stealing from Nessie (11)", "Ne rien cocher"],
    });
    s = option(s, 0);
    expect(s.cards[adv(1)]?.checkedBoxes).toContain("1/c1");
    expect(s.pending).toEqual({ kind: "newCards", cards: [adv(7)] });
    expect(s.zones.permanent).toContain(adv(7));
  });

  it("3 manches puis fin : les cartes restées dans la boîte y restent, la carte des aventures sert encore ensuite", () => {
    let s = run(catalog, finished(), { type: "startGrandExpansion", expansion: "FK_Adventures" });
    s = autoplay(s, (x) => x.phase === "gameOver");
    expect(s.campaign?.played.at(-1)).toMatchObject({ expansion: "FK_Adventures", name: "Adventures" });
    // Rien n'est détruit à la fin : la carte des aventures découvrira les autres plus tard.
    expect(s.log.some((l) => /^Adventures #\d+ reste dans la boîte$/.test(l.text))).toBe(true);
    expect(s.zones.box.filter((id) => id.startsWith("FK_Adventures")).length).toBeGreaterThan(10);
    expect(s.zones.permanent).toContain(adv(1));
  });

  /** Fin du tour, deck vide : fin de manche, puis début de la suivante (découvertes de la boîte de base acceptées). */
  const toNextRound = (st: GameState): GameState => {
    let s = st;
    s.zones.deck = [];
    s = run(catalog, s, { type: "pass" });
    for (let i = 0; i < 20 && s.pending && s.pending.kind !== "choice"; i++) s = run(catalog, s, getLegalActions(catalog, s)[0] as Action);
    return s;
  };

  it("Fountain of Youth découverte par la carte des aventures : Eustace (17) l'est aussi, montrées ensemble", () => {
    let s = place(withAdv(arrange(catalog, { play: [1], deck: [2, 3] })), "permanent", 1);
    s = toNextRound(s);
    expect(choice(s)?.request.prompt).toBe("Carte des aventures : cocher un lieu pour découvrir son aventure ?");
    s = option(s, 1);
    expect(s.pending).toEqual({ kind: "newCards", cards: [adv(8), adv(17)] });
    expect(s.zones.permanent).toContain(adv(8));
  });

  it("Changeling : tourmente une personne (permanente, inutilisable), libérée quand il est vaincu", () => {
    let s = place(withAdv(arrange(catalog, { play: [10, 1], deck: [2, 3, 4], resources: { sword: 15 } })), "deck", 3);
    s.zones.deck = [adv(3), ...s.zones.deck.filter((id) => id !== adv(3))];
    s = run(catalog, s, { type: "advance" });
    expect(s.zones.permanent).toContain(fk(10));
    expect(s.cards[fk(10)]?.tormentedBy).toEqual({ card: adv(3), stage: 1 });
    expect(legal(catalog, s).some((a) => a.type === "useEffect" && a.card === fk(10))).toBe(false);
    for (let i = 0; i < 4; i++) s.cards[adv(3)]?.checkedBoxes.push(`1/c${i + 1}`);
    s = use(s, adv(3), "e2");
    expect(s.zones.destroyed).toContain(adv(3));
    // « discover 25 » : la nouvelle carte est montrée ; la personne est libérée dès que plus rien n'est en attente.
    expect(s.pending).toEqual({ kind: "newCards", cards: [adv(25)] });
    s = run(catalog, s, { type: "acknowledgeDiscoveries" });
    expect(s.cards[fk(10)]?.tormentedBy).toBeUndefined();
    expect(s.zones.discard).toContain(fk(10));
  });

  it("The Green Dragon : l'affronter, étape par étape (celles qu'on ne peut pas faire sont sautées)", () => {
    let s = orient(place(withAdv(arrange(catalog, { play: [1, 2, 3, 4], deck: [5, 6] })), "permanent", 5), 5, "back");
    s = place(s, "deck", 14);
    s.zones.deck = [adv(14), ...s.zones.deck.filter((id) => id !== adv(14))];
    s = run(catalog, s, { type: "advance" });
    // The Green Dragon : affronter ; 1) 3 cartes, 2) 1 carte rayée et défaussée, 3) 1 carte détruite.
    expect(choice(s)?.request).toMatchObject({ type: "option" });
    s = option(s, 1);
    s = pick(s, fk(1), fk(2), fk(3));
    // 2) Wild Grass 4 ou Distant Mountain 5 ; 3) la dernière carte amie en jeu, choisie d'office : Garrisoned Border
    // (en jeu ici) la sauve en cochant une case.
    s = pick(s, fk(4));
    expect(s.pending).toBeNull();
    expect(s.zones.destroyed).not.toContain(fk(5));
    expect(s.cards[adv(5)]?.checkedBoxes).toEqual(["4/c1"]);
    expect(s.cards[fk(4)]?.crossedOutProduction).toHaveLength(1);
    expect(s.cards[adv(14)]?.checkedBoxes.filter((k) => /c(4|5|6)$/.test(k)).length).toBe(3);
  });

  it("Garrisoned Border sauve de la destruction par une carte négative (Jack-in-Irons, fin de manche)", () => {
    let s = orient(place(withAdv(arrange(catalog, { play: [1, 10], deck: [2, 3] })), "permanent", 5), 5, "back");
    s = place(s, "permanent", 9);
    s = toNextRound(s);
    // 1 personne ou 2 autres cartes amies : 1 personne, Trader.
    expect(choice(s)?.request.prompt).toBe("Jack-in-Irons : que détruire ?");
    // La seule personne est choisie d'office.
    s = option(s, 0);
    expect(s.zones.destroyed).not.toContain(fk(10));
    expect(s.cards[adv(5)]?.checkedBoxes).toEqual(["4/c1"]);
  });

  it("purge : Elixir of Eternal Life sauve une personne en cochant une case", () => {
    let s = finished();
    s = orient(place(withAdv(s), "permanent", 8), 8, "back");
    s.phase = "gameOver";
    s = run(catalog, s, { type: "startExpansion", card: fk(136) });
    let saw = false;
    for (let i = 0; i < 10 && choice(s); i++) {
      const r = choice(s)?.request;
      if ((r?.prompt ?? "").startsWith("Elixir")) {
        saw = true;
        const opts = r?.type === "cards" ? r.options : [];
        s = pick(s, opts[0] ?? "");
        expect(s.zones.purged).not.toContain(opts[0]);
        expect(s.cards[adv(8)]?.checkedBoxes).toEqual(["4/c1"]);
        break;
      }
      // Paquets : une personne si possible.
      const opts = r?.type === "cards" ? r.options : [];
      const person = opts.find((id) => ["Trader", "Field Worker", "Opportunist"].some((n) => (catalog.templates.get(s.cards[id]?.templateId ?? "")?.stages["1"]?.name ?? "") === n));
      s = pick(s, ...(r?.type === "cards" && r.min === 0 ? [] : [person ?? opts[0] ?? ""]));
    }
    expect(saw).toBe(true);
  });

  it("Wheel of Fortune : la carte du dessous du deck est bloquée, les cartes qui partagent un mot-clé produisent double", () => {
    let s = orient(place(withAdv(arrange(catalog, { play: [1], deck: [2, 3, 4, 5, 7] })), "deck", 6), 6, "back");
    s.zones.deck = [adv(6), ...s.zones.deck.filter((id) => id !== adv(6))];
    s = run(catalog, s, { type: "advance" });
    // Dessous du deck : Forest (Land) ; Wild Grass (Land) produit 2 {coin}.
    expect(s.zones.blocked).toContain(fk(7));
    expect(productionGroups(catalog, s, fk(1)).flatMap((g) => g.options[0] ?? [])).toEqual(["coin", "coin"]);
  });

  it("Merlin : un sticker remplace un cadre d'effet (Alchemy : gagner 6 {coin})", () => {
    let s = place(withAdv(arrange(catalog, { play: [1], deck: [2, 3] })), "play", 4);
    s = use(s, adv(4), "e4");
    expect(choice(s)?.request).toMatchObject({ type: "option" });
    s = option(s, 0);
    expect(s.cards[adv(4)]?.crossedOutEffects).toContain("1/e4");
    expect(s.cards[adv(4)]?.stickers).toEqual([expect.objectContaining({ sticker: "87a", replaces: "e4", stage: 1 })]);
    // Merlin est défaussé (effet activé) ; rejoué, son sticker donne 6 {coin}.
    s.zones.discard = s.zones.discard.filter((id) => id !== adv(4));
    s.zones.play.push(adv(4));
    s = use(s, adv(4), "sticker87a");
    expect(s.resources.coin).toBe(6);
  });

  it("Ancient : défaussé, il coche une case et le tour continue", () => {
    let s = place(withAdv(arrange(catalog, { play: [1], deck: [2, 3] })), "play", 20);
    const turn = s.turn;
    s = run(catalog, s, { type: "pass" });
    expect(choice(s)?.request).toMatchObject({ type: "option", labels: ["Oui", "Non"] });
    s = option(s, 0);
    expect(s.turn).toBe(turn);
    expect(s.zones.play).toContain(fk(1));
    expect(s.zones.discard).toContain(adv(20));
    expect(s.cards[adv(20)]?.checkedBoxes).toEqual(["1/c1"]);
  });

  it("Prydwen : une carte noble qui produit peut rester en jeu, Prydwen est défaussée à sa place", () => {
    let s = orient(place(withAdv(arrange(catalog, { play: [1], deck: [2, 3] })), "play", 21), 21, "back");
    s.cards[fk(1)]?.stickers.push({ sticker: "56", stage: 1, keyword: "Noble" });
    s = run(catalog, s, { type: "produce", card: fk(1), choices: [0] });
    expect(choice(s)?.request).toMatchObject({ labels: ["Oui", "Non"] });
    s = option(s, 0);
    expect(s.zones.play).toContain(fk(1));
    expect(s.zones.discard).toContain(adv(21));
    expect(s.resources.coin).toBe(1);
  });

  it("Jack-in-Irons : la piste rouge complète le vainc (Cerapter)", () => {
    let s = place(withAdv(arrange(catalog, { play: [1], deck: [2, 3], resources: { sword: 3 } })), "permanent", 9);
    for (let i = 1; i <= 4; i++) s.cards[adv(9)]?.checkedBoxes.push(`1/c${i}`);
    s = use(s, adv(9), "e1");
    expect(s.cards[adv(9)]?.orientation.side).toBe("back");
    expect(s.zones.discard).toContain(adv(9));
  });

  it("Fiddler's Green : chaque carte maritime détruite compte 5 {fame}", () => {
    let s = orient(place(withAdv(arrange(catalog, { play: [1, 2, 3, 4], deck: [5, 6] })), "permanent", 2), 2, "back");
    s = place(s, "deck", 21, 14);
    s.zones.deck = [adv(14), adv(21), ...s.zones.deck.filter((id) => id !== adv(14) && id !== adv(21))];
    expect(cardFame(catalog, s, adv(2))).toBe(0);
    // The Green Dragon arrive avec The Flying Dutchman (maritime) : affronté, l'étape 3 détruit le navire.
    s = run(catalog, s, { type: "advance" });
    s = option(s, 1);
    s = pick(s, fk(1), fk(2), fk(3));
    s = pick(s, fk(4));
    expect(s.zones.destroyed).toContain(adv(21));
    expect(cardFame(catalog, s, adv(2))).toBe(5);
  });

  it("Hamelin : défaussée dès qu'une carte négative est en jeu", () => {
    let s = orient(place(withAdv(arrange(catalog, { play: [1], deck: [28, 3] })), "play", 13), 13, "back");
    s = run(catalog, s, { type: "advance" });
    expect(s.zones.discard).toContain(adv(13));
  });
});
