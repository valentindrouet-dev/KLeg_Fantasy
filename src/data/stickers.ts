import stickersJson from "../../data/stickers.json";
import { StickersFileSchema, type StickerDef } from "./schema";

// Catalogue des stickers (spec 3.6) relevé sur la planche officielle : seule source des numéros de stickers.

export const STICKERS: readonly StickerDef[] = StickersFileSchema.parse(stickersJson).stickers;
