// Icônes d'interface (traits, couleur du texte), toutes dans une grille 24 × 24.

const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Royaumes (retour à la liste) : château. */
export function CastleIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M3 21h18M4 21V9h3V6h2v3h2V6h2v3h2V6h2v3h3v12" />
      <path d="M10 21v-4a2 2 0 0 1 4 0v4" />
    </svg>
  );
}

export function UndoIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}

/** Infobulles de traduction : bulle avec « FR ». */
export function TranslateIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4z" />
      <text x="12" y="13.2" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">
        FR
      </text>
    </svg>
  );
}

export function AdvanceIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="3" y="5" width="8" height="12" rx="1.5" />
      <path d="M14 11h7M18 8l3 3-3 3" />
    </svg>
  );
}

export function PassIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M5 12h12M13 6l6 6-6 6" />
    </svg>
  );
}
