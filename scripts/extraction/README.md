# Saisie des fiches (extraction visuelle)

Ces scripts Python ont produit les 140 fiches de `data/cards/FeudalKingdom/`. Ils contiennent ce qui a été lu sur les images, carte par carte, sous une forme compacte et relisible.

- `kl.py` : aide à la saisie. Complète chaque fiche avec les données du site (`data/raw`), calcule les cibles d'amélioration à partir des flèches, et signale les écarts entre la lecture de l'image et le glossaire du site.
- `common.py` : cartes et stages répétés (Distant Mountain, Forest, Wall, Enemy Soldier...).
- `batches/b01.py` à `b11.py` : un fichier par lot de cartes.

## Régénérer les fiches

Il faut d'abord le cache du scraper (`npm run scrape`, qui remplit `data/raw`, hors dépôt). Puis, depuis la racine du projet :

```bash
for f in scripts/extraction/batches/b*.py; do PYTHONPATH=scripts/extraction python3 "$f"; done
```

Les lots doivent être rejoués dans l'ordre : certains réécrivent une carte saisie plus tôt (0, 23, 70, 136).

Afficher ce que le site dit des cartes 48 à 59 : `python3 scripts/extraction/kl.py 48 59`.
Planches de lecture (chaque face à l'endroit et retournée) : `npx tsx scripts/stage-sheets.ts --from 48 --to 59`, sortie dans `data/raw/sheets`.

Pour corriger une carte, on peut modifier directement son JSON ; le lot correspondant sert alors de trace de la saisie d'origine.
