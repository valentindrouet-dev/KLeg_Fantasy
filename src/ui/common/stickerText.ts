// Stickers cités par leur numéro dans un texte (« sticker 7 », « sticker 1 / 2 », « sticker 13k ») : le symbole suit
// chaque numéro (demande du 2026-10-05). Calcul pur, testé côté Node ; le rendu est dans IconText.

/** Icône (src/ui/icons) de chaque sticker de la planche Feudal Kingdom (data/stickers.json). */
export const STICKER_ICONS: Readonly<Record<string, string>> = {
  "1": "coin",
  "2": "wood",
  "3": "stone",
  "4": "metal",
  "5": "sword",
  "6": "tradeGood",
  "7": "staysInPlay",
  "8": "fame2",
  "10": "fame5",
  "11": "knight",
  "13k": "scorePath",
  "13e": "scorePathMer",
  "16": "fame",
  "17": "startsInPlay",
  "18": "bottomOfDeck",
  // Ridding the Woods et Feudal Kingdom Adventures.
  "13c": "scorePathRid",
  "13j": "scorePathFka",
  "38": "blessed",
  "53": "cerapterTab",
  "54": "activated",
  "55": "armored",
  "56": "noble",
  "57": "magical",
  "86a": "passive",
  "86b": "passive",
  "87a": "activated",
  "87b": "activated",
  "88a": "activated",
  "88b": "activated",
  "89a": "activated",
  "89b": "activated",
};

/** Sens d'un sticker, pour le libellé de son symbole. */
export const STICKER_LABELS: Readonly<Record<string, string>> = {
  "1": "or",
  "2": "bois",
  "3": "pierre",
  "4": "métal",
  "5": "épée",
  "6": "marchandise",
  "7": "Stays in play",
  "8": "gloire 2",
  "10": "gloire 5",
  "11": "Knight",
  "13k": "chemin de score",
  "13e": "chemin de score Merchants",
  "16": "gloire écrite",
  "17": "Starts in play",
  "18": "dessous du deck",
  "13c": "chemin de score Ridding the Woods",
  "13j": "chemin de score Adventures",
  "38": "béni",
  "53": "onglet de Cerapter",
  "54": "jouer Cerapter",
  "55": "armure",
  "56": "noble",
  "57": "magique",
  "86a": "Authority",
  "86b": "Friendship",
  "87a": "Alchemy",
  "87b": "Conjure",
  "88a": "Fireball",
  "88b": "Transform",
  "89a": "Summon",
  "89b": "Wonders",
};

const STICKER_PHRASE = /(stickers? )(\d+[a-z]?(?:\s*(?:\/|&|and|or|,)\s*\d+[a-z]?)*)/gi;

/** Le texte en morceaux : texte simple, ou numéro de sticker (suivi de son symbole à l'affichage). */
export function splitStickers(text: string): (string | { sticker: string })[] {
  const out: (string | { sticker: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(STICKER_PHRASE)) {
    const start = m.index ?? 0;
    out.push(text.slice(last, start) + (m[1] ?? ""));
    (m[2] ?? "").split(/(\d+[a-z]?)/).forEach((piece, j) => out.push(j % 2 === 0 ? piece : { sticker: piece }));
    last = start + m[0].length;
  }
  out.push(text.slice(last));
  return out.filter((x) => x !== "");
}

/** Numéros de stickers cités dans ces textes, dans l'ordre, sans doublon. */
export function stickersIn(texts: readonly string[]): string[] {
  const out: string[] = [];
  for (const t of texts) for (const x of splitStickers(t)) if (typeof x !== "string" && !out.includes(x.sticker)) out.push(x.sticker);
  return out;
}
