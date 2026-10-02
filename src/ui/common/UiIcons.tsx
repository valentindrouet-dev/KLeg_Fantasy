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

export function PlayIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function RestartIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M4 4v6h6" />
      <path d="M5.6 15a7 7 0 1 0 1.4-7.3L4 10" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CardsIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="3" y="6" width="11" height="15" rx="2" />
      <path d="M8 3h11a2 2 0 0 1 2 2v13" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </svg>
  );
}

export function SortIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
    </svg>
  );
}

export function StatsIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function SaveIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}

export function ImportIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />
    </svg>
  );
}

/** Résolution à la main : main ouverte. */
export function HandIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 11.5v-7a1.5 1.5 0 0 1 3 0v7" />
      <path d="M14 11.5V6a1.5 1.5 0 0 1 3 0v7.5" />
      <path d="M17 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.6-2.2L4 15a1.6 1.6 0 0 1 2.4-2.1L8 14.5" />
    </svg>
  );
}
