// Version de l'appli, tirée de package.json au build (voir CHANGELOG.md).
// Convention : package.json « 0.5.0 » s'affiche « v0.05 » ; un correctif « 0.5.1 » s'affiche « v0.05.1 ».

declare const __APP_VERSION__: string;

export function formatVersion(semver: string): string {
  const [major = "0", minor = "0", patch = "0"] = semver.split(".");
  return `v${major}.${minor.padStart(2, "0")}${patch !== "0" ? `.${patch}` : ""}`;
}

export const APP_VERSION = formatVersion(typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0");
