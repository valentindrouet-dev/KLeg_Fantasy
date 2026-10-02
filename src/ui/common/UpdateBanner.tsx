import { useEffect, useState } from "react";
import { APP_VERSION, formatVersion } from "../../version";
import styles from "./common.module.css";

// Mises à jour de l'appli installée sur l'écran d'accueil de l'iPad : elle garde sa page en mémoire et ne se
// recharge pas d'elle-même. On consulte version.json (sans cache) au démarrage, au retour dans l'appli et toutes
// les 15 minutes ; si une nouvelle version est publiée, un bouton recharge la page en contournant le cache.

const CHECK_EVERY_MS = 15 * 60 * 1000;

async function publishedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

export function UpdateBanner() {
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    const check = () =>
      void publishedVersion().then((v) => {
        if (v && formatVersion(v) !== APP_VERSION) setNext(v);
      });
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  if (!next) return null;
  const reload = () => window.location.replace(`${window.location.pathname}?v=${next}${window.location.hash}`);
  return (
    <button className={styles.updateBanner} onClick={reload}>
      ⟳ {formatVersion(next)} disponible : mettre à jour
    </button>
  );
}
