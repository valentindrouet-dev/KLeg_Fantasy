// Générateur pseudo-aléatoire à graine (mulberry32) : mélanges reproductibles (spec 4.1).
// L'état tient dans un entier 32 bits stocké dans GameState.rng.

export function nextRandom(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/** Mélange de Fisher-Yates. Renvoie le tableau mélangé et le nouvel état du générateur. */
export function shuffle<T>(items: readonly T[], state: number): { items: T[]; state: number } {
  const out = [...items];
  let rng = state;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextRandom(rng);
    rng = r.state;
    const j = Math.floor(r.value * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return { items: out, state: rng };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
