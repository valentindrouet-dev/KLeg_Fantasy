import { z } from "zod";

// Schémas Zod = source de vérité du modèle de données (spec section 3).
// Les types TS sont dérivés par z.infer. Conventions d'extraction : docs/DATA_EXTRACTION.md.

export const StageIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type StageId = z.infer<typeof StageIdSchema>;
export const STAGE_IDS: readonly StageId[] = [1, 2, 3, 4];

export const SideSchema = z.enum(["front", "back"]);
export type Side = z.infer<typeof SideSchema>;
export const RotationSchema = z.union([z.literal(0), z.literal(180)]);
export type Rotation = z.infer<typeof RotationSchema>;
export const OrientationSchema = z.strictObject({ side: SideSchema, rotation: RotationSchema });
export type Orientation = z.infer<typeof OrientationSchema>;

export const ORIENTATION_KEYS = ["front-0", "front-180", "back-0", "back-180"] as const;
export type OrientationKey = (typeof ORIENTATION_KEYS)[number];

// Rotation 0 = image du site à l'endroit (sceau en haut).
export const OrientationToStageSchema = z.strictObject({
  "front-0": StageIdSchema.nullable(),
  "front-180": StageIdSchema.nullable(),
  "back-0": StageIdSchema.nullable(),
  "back-180": StageIdSchema.nullable(),
});
export type OrientationToStage = z.infer<typeof OrientationToStageSchema>;

// Identifiants data-driven : validés contre data/resources.json par validate.ts.
export const ResourceIdSchema = z.string().min(1);
export type ResourceId = z.infer<typeof ResourceIdSchema>;

export const KeywordSchema = z.string().min(1);
export type Keyword = z.infer<typeof KeywordSchema>;

// Ajouts à la liste de la spec : "none" pour les cartes sans bandeau (parchemins, cartes de piste)
// et "goal" pour les objectifs (bandeau jaune comme les personnes, mais ce ne sont pas des personnes).
export const CategorySchema = z.enum([
  "building",
  "person",
  "land",
  "livestock",
  "seafaring",
  "other",
  "negative",
  "goal",
  "none",
]);
export type Category = z.infer<typeof CategorySchema>;

export const EffectTypeSchema = z.enum([
  "passive",
  "activated",
  "time",
  "destroy",
  "triggeredOptional",
  "triggeredForced",
  "oneTime",
]);
export type EffectType = z.infer<typeof EffectTypeSchema>;

// Un groupe de production = ce que la carte donne quand on produit avec.
// `options` porte le "/" (OU) : le joueur choisit une option, chaque option liste ses icônes une par une
// (granularité icône, nécessaire pour rayer une production ou une icône de coût).
// Ex. 2 pièces : [{ id: "p1", options: [["coin", "coin"]] }]
// Ex. bois / pierre / métal : [{ id: "p1", options: [["wood"], ["stone"], ["metal"]] }]
export const ProductionGroupSchema = z.strictObject({
  id: z.string().min(1),
  options: z.array(z.array(ResourceIdSchema).min(1)).min(1),
});
export type ProductionGroup = z.infer<typeof ProductionGroupSchema>;

export const UpgradeSchema = z.strictObject({
  id: z.string().min(1),
  cost: z.array(ResourceIdSchema), // icônes de ressources de la boîte marron, une par une
  otherCost: z.string().optional(), // coût non-ressource, texte brut en attendant le DSL
  arrow: z.enum(["rotate", "flip"]),
  toStage: StageIdSchema,
});
export type Upgrade = z.infer<typeof UpgradeSchema>;

export const EffectSchema = z.strictObject({
  id: z.string().min(1),
  type: EffectTypeSchema,
  text: z.string().min(1), // texte original, icônes en tokens {coin}, {rotate}...
  oneTime: z.boolean().optional(), // icône "one-time" en plus du type : rayé après usage
  dsl: z.unknown().optional(), // défini en P3 (docs/CARD_DSL.md)
});
export type Effect = z.infer<typeof EffectSchema>;

export const CheckboxSchema = z.strictObject({
  id: z.string().min(1),
  icon: z.string().min(1).optional(), // marqueur non-ressource dans la case (asterisk)
  gain: z.array(ResourceIdSchema).optional(), // ressources imprimées dans la case, gagnées en la cochant
  cost: z.array(ResourceIdSchema).optional(), // ressources à dépenser pour cocher (cartes de piste)
  fame: z.number().int().optional(), // gloire imprimée dans la case
  threshold: z.number().int().optional(), // seuil à atteindre pour cocher (Export)
  text: z.string().optional(), // effet associé à la case
});
export type Checkbox = z.infer<typeof CheckboxSchema>;

export const DefeatSpecSchema = z.strictObject({
  kind: z.enum(["destroy", "turn", "checkbox", "none"]),
  cost: z.array(ResourceIdSchema).optional(),
  text: z.string().optional(),
});
export type DefeatSpec = z.infer<typeof DefeatSpecSchema>;

export const StageSchema = z.strictObject({
  id: StageIdSchema,
  name: z.string(), // vide seulement si rien n'est imprimé (verso de parchemin)
  keywords: z.array(KeywordSchema),
  category: CategorySchema,
  negative: z.boolean(),
  permanent: z.boolean(),
  fame: z.number().int(), // gloire fixe imprimée (0 si aucune)
  fameVariable: z.boolean().optional(), // gloire calculée par une règle du texte ("*", "50+")
  production: z.array(ProductionGroupSchema),
  upgrades: z.array(UpgradeSchema),
  effects: z.array(EffectSchema),
  checkboxes: z.array(CheckboxSchema),
  staysInPlay: z.boolean(),
  equip: z.strictObject({ keyword: KeywordSchema }).optional(),
  cannotBeDestroyed: z.boolean().optional(),
  cannotBePurged: z.boolean().optional(),
  defeat: DefeatSpecSchema.optional(),
  text: z.string(), // texte imprimé complet du stage (affichage + fallback manuel)
  text_fr: z.string().optional(),
  flavor: z.string().optional(), // texte d'ambiance en italique
  siteKeywords: z.array(z.string()), // glossaire affiché par le site pour ce stage
  helpText: z.string().optional(), // explication du site pour ce stage
});
export type Stage = z.infer<typeof StageSchema>;

export const CardTemplateSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_]+-\d{3}$/), // "FeudalKingdom-001"
  expansion: z.string().min(1),
  serial: z.number().int().min(0),
  origin: z.enum(["official", "custom"]),
  images: z.strictObject({ front: z.string().min(1), back: z.string().min(1) }), // relatifs à data/images/
  orientationToStage: OrientationToStageSchema,
  isParchment: z.boolean(),
  chooseSideOnDiscover: z.boolean(),
  isFinalRoundMarker: z.boolean().optional(),
  stages: z.strictObject({
    "1": StageSchema.optional(),
    "2": StageSchema.optional(),
    "3": StageSchema.optional(),
    "4": StageSchema.optional(),
  }),
  description: z.string().optional(), // texte d'aide du site (niveau carte)
  source: z.strictObject({ url: z.string().min(1), scrapedAt: z.string().min(1) }),
  confidence: z.number().min(0).max(1),
  to_verify: z.array(z.string()),
});
export type CardTemplate = z.infer<typeof CardTemplateSchema>;

export const ResourceDefSchema = z.strictObject({
  id: ResourceIdSchema,
  label_fr: z.string().min(1),
  label_en: z.string().min(1),
  siteTokens: z.array(z.string()), // tokens utilisés par le site, ex. "[money]"
  expansion: z.string().optional(), // absent = ressource de base
});
export type ResourceDef = z.infer<typeof ResourceDefSchema>;
export const ResourcesFileSchema = z.strictObject({ resources: z.array(ResourceDefSchema) });

// Catalogue des stickers (spec 3.6), relevé sur la planche officielle (data/stickers.json).
export const StickerDefSchema = z.strictObject({
  id: z.string().min(1), // numéro imprimé, ex. "16", "13k"
  expansion: z.string().min(1), // planche d'origine
  type: z.enum(["resource", "fame", "writtenFame", "effect", "keyword", "scorePath", "tab", "other"]),
  label: z.string(),
  quantity: z.number().int().min(0),
  resource: ResourceIdSchema.optional(), // type resource : +1 production de cette ressource
  fame: z.number().int().optional(), // type fame : gloire imprimée
  text: z.string().optional(), // type effect : texte imprimé sur le sticker
  keyword: KeywordSchema.optional(), // type keyword : mot-clé ajouté à la carte
});
export type StickerDef = z.infer<typeof StickerDefSchema>;
export const StickersFileSchema = z.strictObject({
  source: z.string().min(1),
  to_verify: z.array(z.string()),
  stickers: z.array(StickerDefSchema),
});

export const ExpansionDefSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["base", "mini", "grand", "custom"]),
  serialFrom: z.number().int(),
  serialTo: z.number().int(),
  sourceUrl: z.string().optional(),
});
export type ExpansionDef = z.infer<typeof ExpansionDefSchema>;
export const ExpansionsFileSchema = z.strictObject({ expansions: z.array(ExpansionDefSchema) });

export function cardId(expansion: string, serial: number): string {
  return `${expansion}-${String(serial).padStart(3, "0")}`;
}

export function orientationKey(o: Orientation): OrientationKey {
  return `${o.side}-${o.rotation}`;
}
