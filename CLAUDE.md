# Kingdom Legacy Digital

La spécification complète du projet est dans [SPEC_kingdom_legacy.md](SPEC_kingdom_legacy.md). Elle fait foi.

Rappels essentiels (section 0 de la spec) :

- Ne jamais inventer de données de carte : tout vient de `data/cards/`. En cas de doute, `to_verify`.
- Règles ambiguës : poser la question, puis consigner dans `docs/RULES_DECISIONS.md`.
- Le moteur d'abord, testé, sans UI. TypeScript strict, pas de `any`.
- Travail par phases (section 12), récap à la fin de chaque phase.
- Interface en français, textes de cartes en anglais.

Conventions d'extraction des cartes : [docs/DATA_EXTRACTION.md](docs/DATA_EXTRACTION.md).

État du projet, décisions et questions ouvertes : [docs/HANDOFF.md](docs/HANDOFF.md).

Versions : chaque mise à jour publiée incrémente la version (`package.json` « 0.5.0 » = v0.05) et ajoute une entrée en tête de [CHANGELOG.md](CHANGELOG.md).
