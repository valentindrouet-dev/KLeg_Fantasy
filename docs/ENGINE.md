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

## Effets des cartes (P3, v0.19)

| Fichier | Rôle |
|---|---|
| `effects/textEffects.ts` | Effets des cartes 1 à 10 et leurs copies (texte exact) |
| `effects/cards.ts` | Tous les autres effets, par texte exact ou par motif : actions (`effect`) et déclencheurs (`trigger`) |
| `passives.ts` | Passifs qui changent les règles : bonus de production, Pirate, interdictions, Blood Curse, Wood Shipment, Watchtower |
| `choice.ts` | Questions au joueur (`ChoiceRequest` : cartes, ressources, option) et réponses (`Answer`) |
| `ops.ts` | Opérations des effets : gains, blocage, reset, stickers, cases à cocher, pioche |
| `score.ts` | Gloire variable (pistes, objectifs, Double Wall, cases écrites) |
| `badges.ts` | Ce que l'interface affiche sur une carte (cartes bloquées, cases, compteur, stickers) |

- **Questions** : `EffectImpl.ask` / `TriggerImpl.ask` posent une question à la fois (décision en attente `choice`) ;
  rien n'est payé avant la dernière réponse, donc un effet lancé par le joueur s'annule (`cancelChoice`).
  Les questions sans vrai choix sont répondues d'office (`nextQuestion`).
- **Déclencheurs** (`TriggerTiming`) : `played`, `otherPlayed`, `endTurn`, `endRound`, `upgraded`, `produced`,
  `betweenRounds`, `manual` (lancé par un autre effet). Mis en file (`FlowStep` « trigger ») dans l'ordre des cartes.
- **Fin de tour et de manche** en étapes : `endTurn` (effets) → `cleanupTurn` (défausse, ressources) → `endRound`
  (défausse, effets « End of Round ») → `nextRound` → découverte → `reviewDiscoveries` (décision `newCards`, à valider
  par `acknowledgeDiscoveries`) → mélange → premier tour. `replay` ajoute la validation aux parties enregistrées avant v0.20.
- **Blocage** : zone `blocked` et `GameState.blocks` (bloquante → cartes) ; une bloquante qui quitte le jeu pendant
  le tour libère ses cartes (`moveTo`), en fin de tour ou de manche elles partent avec elle.
- **Couverture** : `tests/rules/coverage.test.ts` vérifie que chaque effet des cartes 1 à 135 est pris en charge ;
  `tests/scenarios/fuzz.test.ts` joue des parties entières au hasard.
- **Hors partie de base (P4)** : purge (Aethan Estate) et mini-extensions 136 à 138.
- Décisions de règles : `docs/RULES_DECISIONS.md` (entrée « effets de toutes les cartes »).

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
