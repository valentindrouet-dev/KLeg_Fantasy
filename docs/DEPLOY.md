# Déploiement

Le site est publié sur GitHub Pages depuis la branche `gh-pages` (spec section 13.1).
À chaque push, GitHub Actions (`.github/workflows/deploy.yml`) installe, lance les tests,
construit `dist/` et le pousse sur `gh-pages`. Aucune commande à lancer depuis le Mac.

Adresse : https://valentindrouet-dev.github.io/KLeg_Fantasy/

## Réglage (une seule fois)

Settings > Pages > Build and deployment :
- Source : **Deploy from a branch**
- Branch : **gh-pages**, dossier **/ (root)**, puis **Save**.

Si la branche choisie est celle du code source, GitHub publie les fichiers bruts et la page reste blanche.

## Écart par rapport à la spec

La spec prévoyait `npm run deploy` depuis le Mac. Le Mac ne pouvant pas pousser sur GitHub, c'est
GitHub Actions qui construit et pousse `gh-pages`. `base: "/KLeg_Fantasy/"` dans `vite.config.ts` reste valable.
