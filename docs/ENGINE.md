# Moteur de règles (phase P1)

Code : `src/engine/`, pur TypeScript, sans dépendance à l'interface, au navigateur ou à Node.
Point d'entrée : `src/engine/index.ts`.

## Principe

- **Event sourcing** : une partie = `GameConfig` (graine, extension, mode d'annulation) + liste d'actions.
  `session.ts` garde l'état après chaque action : annuler revient à retirer la dernière, `replay` rejoue un enregistrement.
- **Hasard à graine** (`rng.ts`) : le même enregistrement donne toujours la même partie.
- **Actions légales** : `getLegalActions(catalog, state)` liste tout ce que le joueur peut faire ;
  `applyAction` refuse le reste (`IllegalActionError`) et ne modifie jamais l'état reçu.
- **Décisions en attente** (`state.pending`) : choix de la carte à découvrir, de la face visible, lecture d'un parchemin.
  Tant qu'une décision est en cours, seules les réponses à cette décision sont légales.
- **File d'étapes** (`state.queue`) : la suite du déroulé (découverte, mélange, tour suivant) reprend après la décision.

## Fichiers

| Fichier | Rôle |
|---|---|
| `types.ts` | État, actions, décisions, catalogue |
| `setup.ts` | Catalogue des cartes, mise en place (cartes 1 à 10), reset possible avant la carte 23 |
| `flow.ts` | Tours, Avancer, fin de tour, fin de manche, découvertes, parchemins |
| `actions.ts` | Actions légales et application des 5 actions + réponses aux décisions |
| `production.ts` | Production (avec stickers), règle d'or 5 |
| `upgrade.ts` | Flèches, coûts en ressources et en cartes, raisons d'impossibilité |
| `effects/textEffects.ts` | Effets reconnus à leur texte imprimé exact |
| `scripts/parchments.ts` | Parchemins 30, 37, 47, 68 |
| `score.ts` | Gloire du royaume + gloire purgée |
| `describe.ts` | Libellés français des actions |
| `manual.ts` | Résolution à la main (P3) : ressources, déplacer, orienter, découvrir, cocher, sticker, effet non automatisé |

## Résolution à la main (spec 5.1, « fallback manuel »)

Action `{ type: "manual", op }`, enregistrée et rejouée comme les autres :

- `effect` : effet d'action (activated, destroy, time) sans automatisation. Énuméré par `getLegalActions` ; il paie le
  coût de son type (défausser, détruire, rayer si usage unique, fin du tour pour « time ») et le joueur applique le reste.
  Pour un effet « time », appliquer le corps avant : l'effet termine le tour.
- `resource`, `move`, `orient`, `discover`, `check`, `sticker` : en nombre illimité, donc validés par `isManualOpValid`
  au lieu d'être énumérés. Interdits pendant une décision ou après la fin de la partie.
- Sortir une carte de la pioche ou de la boîte augmente `revealCount` (pas d'annulation stricte ensuite).
- Cases cochées : `CardInstance.checkedBoxes`, clé `checkKey(stage, case)` (ex. `1/c3`).

## Couverture en fin de P1

- Règles : mise en place, tours, 5 actions, ressources éphémères, stay in play, fin de manche, découverte de 2 cartes,
  parchemins, cartes à flèches (choix de la face), cartes permanentes, dernière manche (carte 68) et score.
- Règles d'or : 1 (pas de changement d'orientation sans règle), 3 (carte tournée = défaussée), 4 (amélioration = fin du tour),
  5 (pas de sticker à 9 de production). La règle 2 (ne jamais montrer la boîte) relève de l'interface (P2).
- Effets automatisés : tous ceux des cartes 1 à 10, et les cartes qui portent exactement le même texte
  (ex. Jungle, Distant Mountain et Forest supplémentaires). Les autres effets ne sont pas encore proposés : DSL et fallback manuel en P3.
- Pas encore traités : effets déclenchés (« when played », fin de tour, fin de manche), blocage, équipement, cases à cocher,
  stickers posés par les effets, parchemins 23 et 24, purge.

## Jouer en ligne de commande

```bash
npm run play                 # graine aléatoire, annulation libre
npm run play -- --seed 42    # partie reproductible
npm run play -- --strict     # annulation stricte
npm run play -- --auto       # partie jouée au hasard jusqu'au bout
```

## Notes pour l'interface

`Session` garde les 40 derniers états (`UNDO_WINDOW`) ; `resumeSession` reprend une partie sauvegardée sans la rejouer.
`state.lostResources` permet d'avertir avant une action qui ferait perdre des ressources (simuler l'action, regarder ce champ).
`state.discoveries` liste les cartes découvertes dans l'ordre.
