import {
  CardTemplateSchema,
  ORIENTATION_KEYS,
  STAGE_IDS,
  cardId,
  type CardTemplate,
  type ResourceDef,
  type Stage,
} from "./schema";

// Validation pure (sans API Vite ni Node) : partagée par l'appli, les scripts et les tests.

// Tokens d'icônes autorisés dans les textes, en plus des identifiants de ressources.
export const ICON_TOKENS = [
  "rotate", // flèche verticale : rotation 180°
  "flip", // flèche horizontale : retournement
  "mark", // croix cerclée : case à cocher
  "asterisk", // astérisque dans une case ou un ruban de gloire
  "negative", // crâne : carte négative
  "fame",
  "passive",
  "activated",
  "time",
  "destroy",
  "triggeredOptional",
  "triggeredForced",
  "oneTime",
] as const;

export type CardIssue = { path: string; message: string };
export type CardParseResult =
  | { ok: true; card: CardTemplate; issues: CardIssue[] }
  | { ok: false; issues: CardIssue[] };

function tokensOf(text: string): string[] {
  return [...text.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] ?? "");
}

function checkStage(key: string, stage: Stage, card: CardTemplate, known: Set<string>): CardIssue[] {
  const issues: CardIssue[] = [];
  const at = (p: string) => `stages.${key}.${p}`;
  if (String(stage.id) !== key) issues.push({ path: at("id"), message: `id ${stage.id} ≠ clé ${key}` });
  if (stage.negative !== (stage.category === "negative")) {
    issues.push({ path: at("negative"), message: "negative doit correspondre à category = negative" });
  }
  const ids = new Set<string>();
  const uniq = (id: string, p: string) => {
    if (ids.has(id)) issues.push({ path: at(p), message: `identifiant en double : ${id}` });
    ids.add(id);
  };
  const res = (r: string, p: string) => {
    if (!known.has(r)) issues.push({ path: at(p), message: `ressource inconnue : ${r}` });
  };
  stage.production.forEach((g, i) => {
    uniq(g.id, `production.${i}.id`);
    g.options.flat().forEach((r) => res(r, `production.${i}`));
  });
  stage.upgrades.forEach((u, i) => {
    uniq(u.id, `upgrades.${i}.id`);
    u.cost.forEach((r) => res(r, `upgrades.${i}.cost`));
    if (u.toStage === stage.id) issues.push({ path: at(`upgrades.${i}.toStage`), message: "amélioration vers soi-même" });
    if (!card.stages[String(u.toStage) as keyof CardTemplate["stages"]]) {
      issues.push({ path: at(`upgrades.${i}.toStage`), message: `stage cible ${u.toStage} absent` });
    }
  });
  stage.effects.forEach((e, i) => uniq(e.id, `effects.${i}.id`));
  stage.checkboxes.forEach((c, i) => {
    uniq(c.id, `checkboxes.${i}.id`);
    c.cost?.forEach((r) => res(r, `checkboxes.${i}.cost`));
    c.gain?.forEach((r) => res(r, `checkboxes.${i}.gain`));
  });
  stage.defeat?.cost?.forEach((r) => res(r, "defeat.cost"));
  const allowed = new Set<string>([...known, ...ICON_TOKENS]);
  const boxTexts = stage.checkboxes.flatMap((c) => (c.text === undefined ? [] : [c.text]));
  const tokens = [stage.text, ...stage.effects.map((e) => e.text), ...boxTexts].flatMap(tokensOf);
  const icons = stage.checkboxes.flatMap((c) => (c.icon === undefined ? [] : [c.icon]));
  for (const t of [...tokens, ...icons]) {
    if (!allowed.has(t)) issues.push({ path: at("text"), message: `token inconnu : {${t}}` });
  }
  return issues;
}

/** Contrôles de cohérence au-delà du schéma. Une liste vide = carte cohérente. */
export function checkCard(card: CardTemplate, resources: readonly ResourceDef[]): CardIssue[] {
  const issues: CardIssue[] = [];
  const known = new Set(resources.map((r) => r.id));
  if (card.id !== cardId(card.expansion, card.serial)) {
    issues.push({ path: "id", message: `attendu ${cardId(card.expansion, card.serial)}` });
  }
  const mapped = ORIENTATION_KEYS.map((k) => card.orientationToStage[k]).filter((s) => s !== null);
  if (new Set(mapped).size !== mapped.length) {
    issues.push({ path: "orientationToStage", message: "un stage est associé à deux orientations" });
  }
  for (const id of STAGE_IDS) {
    const key = String(id) as keyof CardTemplate["stages"];
    const stage = card.stages[key];
    if (stage && !mapped.includes(id)) {
      issues.push({ path: `stages.${key}`, message: "stage défini mais absent de orientationToStage" });
    }
    if (!stage && mapped.includes(id)) {
      issues.push({ path: "orientationToStage", message: `stage ${id} référencé mais non défini` });
    }
    if (stage) issues.push(...checkStage(key, stage, card, known));
  }
  if (card.chooseSideOnDiscover && (card.orientationToStage["front-0"] === null || card.orientationToStage["back-0"] === null)) {
    issues.push({ path: "chooseSideOnDiscover", message: "il faut un stage sur chaque face (sceau en haut)" });
  }
  return issues;
}

export function parseCard(json: unknown, resources: readonly ResourceDef[]): CardParseResult {
  const parsed = CardTemplateSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  return { ok: true, card: parsed.data, issues: checkCard(parsed.data, resources) };
}
