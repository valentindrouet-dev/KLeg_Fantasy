# DSL d'effets

À définir en phase P3 (spec section 5). Les fiches portent pour chaque effet son `type` et son `text` ; le champ `dsl` est absent.

En P1, `src/engine/effects/textEffects.ts` reconnaît quelques formulations exactes (« Spend X to gain Y/Z. »,
« Discard a friendly card to gain X. », « Gain X, then {rotate}. », « Discover Nom (a / b). », « Play 1 land from discard pile. »).
Le DSL les remplacera.
