# Kingdom Legacy Digital

Application personnelle pour jouer à Kingdom Legacy : Feudal Kingdom. Spécification : [SPEC_kingdom_legacy.md](SPEC_kingdom_legacy.md).

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance l'appli (pour l'instant : la visionneuse de données) sur http://localhost:5173/KLeg_Fantasy/ ; version en ligne : https://valentindrouet-dev.github.io/KLeg_Fantasy/ |
| `npm test` | Tests (fiches de cartes, règles du moteur, parties complètes) |
| `npm run play` | Partie en ligne de commande (`-- --seed 42`, `-- --strict`, `-- --auto`), voir [docs/ENGINE.md](docs/ENGINE.md) |
| `npm run validate` | Liste les fiches invalides et les points à vérifier |
| `npm run scrape` | Récupère les pages et images du site (cache dans `data/raw`, hors dépôt) |
| `npm run images` | Convertit les images en WebP dans `data/images` |
| `npm run build` | Construit le site dans `dist/` |

## Vérifier les cartes

1. `npm run dev`, puis ouvrir http://localhost:5173/KLeg_Fantasy/
2. Filtre « À vérifier » : chaque carte affiche ses images à côté des données extraites et la liste des doutes.
3. Pour corriger une carte : modifier `data/cards/FeudalKingdom/{n}.json`, la page se recharge.

Conventions des fiches : [docs/DATA_EXTRACTION.md](docs/DATA_EXTRACTION.md).
