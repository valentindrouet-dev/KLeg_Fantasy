import { describe, expect, it } from "vitest";
import { splitStickers, STICKER_ICONS } from "../../src/ui/common/stickerText";

// « Sticker 7 » seul ne dit pas de quel sticker il s'agit : son symbole suit le numéro (demande du 2026-10-05).
describe("stickers cités par numéro", () => {
  const ids = (t: string) => splitStickers(t).flatMap((x) => (typeof x === "string" ? [] : [x.sticker]));
  it("un symbole après chaque numéro", () => {
    expect(ids("Sticker 7 on 1 person.")).toEqual(["7"]);
    expect(ids("End of Round: Add sticker 1 & 5 & 11 to 1 person.")).toEqual(["1", "5", "11"]);
    expect(ids("Sticker 2 / 3 / 4 / 5 on 1 friendly card.")).toEqual(["2", "3", "4", "5"]);
    expect(ids("Then destroy this card, add sticker 13k to your box's score path")).toEqual(["13k"]);
  });
  it("le texte reste entier, les autres nombres sans symbole", () => {
    const parts = splitStickers("Discard 2 buildings to add sticker 1 to 1 land in play.");
    expect(parts.map((x) => (typeof x === "string" ? x : x.sticker)).join("")).toBe("Discard 2 buildings to add sticker 1 to 1 land in play.");
    expect(ids("Discard 2 buildings to add sticker 1 to 1 land in play.")).toEqual(["1"]);
  });
  it("chaque sticker cité par les cartes a un symbole", () => {
    for (const n of ["1", "2", "3", "4", "5", "6", "7", "8", "10", "11", "13k", "13e", "16", "17", "18"]) expect(STICKER_ICONS[n], n).toBeDefined();
  });
});
