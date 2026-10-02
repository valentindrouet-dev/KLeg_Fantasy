// Valide toutes les fiches de data/cards et data/custom (schéma Zod + cohérence).
//   npm run validate

import { existsSync } from "node:fs";
import path from "node:path";
import { readCardFiles, readResources } from "./cardFiles";

const resources = await readResources();
let cards = 0;
let invalid = 0;
let toVerify = 0;
for (const root of ["data/cards", "data/custom"]) {
  if (!existsSync(root)) continue;
  for (const { file, result } of await readCardFiles(root, resources)) {
    cards += 1;
    if (result.issues.length > 0) {
      invalid += 1;
      console.error(`✗ ${file}`);
      for (const issue of result.issues) console.error(`    ${issue.path} : ${issue.message}`);
    }
    if (result.ok) {
      const imagesOk = [result.card.images.front, result.card.images.back].every((img) =>
        existsSync(path.join("data/images", img)),
      );
      if (!imagesOk) console.warn(`! ${file} : image WebP manquante (npm run images)`);
      if (result.card.to_verify.length > 0) {
        toVerify += 1;
        console.log(`? ${file} (confiance ${result.card.confidence})`);
        for (const note of result.card.to_verify) console.log(`    ${note}`);
      }
    }
  }
}
console.log(`\n${cards} carte(s), ${invalid} invalide(s), ${toVerify} avec points à vérifier.`);
if (invalid > 0) process.exitCode = 1;
