import { APP_VERSION } from "../../version";

// Signaler un bug ou une idée : ouvre un nouveau ticket GitHub pré-rempli (version, appareil, partie en cours).
// Les tickets se lisent ensuite dans une session Claude Code (« regarde les tickets ouverts »).

const REPO = "https://github.com/valentindrouet-dev/KLeg_Fantasy";

export function feedbackUrl(context?: string): string {
  const body = [
    "**Ce qui se passe :**",
    "",
    "",
    "**Ce que j'attends :**",
    "",
    "",
    "---",
    `Version : ${APP_VERSION}`,
    `Écran : ${window.innerWidth} × ${window.innerHeight}`,
    `Appareil : ${navigator.userAgent}`,
    ...(context ? [`Partie : ${context}`] : []),
  ].join("\n");
  return `${REPO}/issues/new?body=${encodeURIComponent(body)}`;
}
