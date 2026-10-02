# Déploiement

Le site est publié sur GitHub Pages par GitHub Actions (`.github/workflows/deploy.yml`) :
à chaque push, le workflow installe, lance les tests, construit `dist/` et le publie.
Aucune commande à lancer depuis le Mac, il suffit de pousser.

Adresse : https://valentindrouet-dev.github.io/KLeg_Fantasy/

## Activation (une seule fois)

Settings > Pages > Build and deployment > Source : **GitHub Actions**.
Puis onglet Actions > « Déploiement GitHub Pages » > Run workflow (ou un nouveau push).

## Écart par rapport à la spec (section 13.1)

La spec prévoyait `npm run deploy` vers une branche `gh-pages`. Ce mode exige de pouvoir
pousser depuis le Mac, ce qui n'était pas configuré ; le déploiement par Actions publie
directement ce qui est poussé. `base: "/KLeg_Fantasy/"` dans `vite.config.ts` reste valable.
