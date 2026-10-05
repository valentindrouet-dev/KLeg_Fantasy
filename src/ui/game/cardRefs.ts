import type { CardTemplate } from "../../data/schema";

// Cartes citées par le texte d'une carte (« Discover Shrine (82 / 83) », « cards 31-34 », « discover card 124 ») :
// le jeu permet de les consulter à tout moment (demande du 2026-10-05). Calcul pur, testé côté Node.

const IN_PARENS = /\((\d{1,3}(?:\s*\/\s*\d{1,3})*)\)/g;
const AFTER_CARD = /\bcards? (\d{1,3}(?:\s*(?:,|-|\/|and|&)\s*(?:and\s*)?\d{1,3})*)/gi;

/** Numéros cités, dans l'ordre du texte, sans doublon ni la carte elle-même. */
export function referencedSerials(t: CardTemplate): number[] {
  const out: number[] = [];
  const add = (n: number) => {
    if (n > 0 && n !== t.serial && !out.includes(n)) out.push(n);
  };
  for (const stage of Object.values(t.stages)) {
    const text = stage?.text ?? "";
    const hits: { at: number; list: number[] }[] = [];
    for (const m of text.matchAll(IN_PARENS)) hits.push({ at: m.index ?? 0, list: (m[1] ?? "").split("/").map(Number) });
    for (const m of text.matchAll(AFTER_CARD)) {
      const list: number[] = [];
      for (const part of (m[1] ?? "").split(/\s*(?:,|\/|and|&)\s*/)) {
        const range = /^(\d+)\s*-\s*(\d+)$/.exec(part.trim());
        if (range) for (let n = Number(range[1]); n <= Number(range[2]) && n - Number(range[1]) < 20; n++) list.push(n);
        else if (/^\d+$/.test(part.trim())) list.push(Number(part.trim()));
      }
      hits.push({ at: m.index ?? 0, list });
    }
    hits.sort((a, b) => a.at - b.at).forEach((h) => h.list.forEach(add));
  }
  return out;
}
