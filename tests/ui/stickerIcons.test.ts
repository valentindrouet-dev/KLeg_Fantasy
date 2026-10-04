import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IconText } from "../../src/ui/common/IconText";

// « Sticker 7 » seul ne dit pas de quel sticker il s'agit : son symbole suit le numéro (demande du 2026-10-05).
describe("symbole des stickers cités par numéro", () => {
  const html = (t: string) => renderToStaticMarkup(createElement(IconText, { text: t }));
  it("un symbole après chaque numéro", () => {
    expect(html("Sticker 7 on 1 person.")).toContain('alt="Sticker 7 : Stays in play"');
    const both = html("End of Round: Add sticker 1 & 5 & 11 to 1 person.");
    for (const n of ["1", "5", "11"]) expect(both).toContain(`alt="Sticker ${n} :`);
    expect(html("Sticker 2 / 3 / 4 / 5 on 1 friendly card.").match(/alt="Sticker/g)).toHaveLength(4);
    expect(html("add sticker 13k to your box's score path")).toContain('alt="Sticker 13k : chemin de score"');
  });
  it("le texte reste lisible, les autres nombres sans symbole", () => {
    const out = html("Discard 2 buildings to add sticker 1 to 1 land in play.");
    expect(out.match(/alt="Sticker/g)).toHaveLength(1);
    expect(out.replace(/<[^>]+>/g, "")).toBe("Discard 2 buildings to add sticker 1 to 1 land in play.");
  });
});
