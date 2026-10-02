import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ResourcesFileSchema, type ResourceDef } from "../src/data/schema";
import { parseCard, type CardParseResult } from "../src/data/validate";

// Lecture des fiches de cartes depuis le disque (scripts Node et tests).

export type CardFile = { file: string; result: CardParseResult };

export async function readResources(): Promise<ResourceDef[]> {
  return ResourcesFileSchema.parse(JSON.parse(await readFile("data/resources.json", "utf8"))).resources;
}

export async function readCardFiles(root: string, resources: readonly ResourceDef[]): Promise<CardFile[]> {
  const out: CardFile[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
    for (const f of files.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))) {
      const file = path.join(dir, f);
      out.push({ file, result: parseCard(JSON.parse(await readFile(file, "utf8")), resources) });
    }
  }
  return out;
}
