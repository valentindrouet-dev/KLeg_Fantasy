import { useEffect, useState } from "react";
import { useCatalog } from "./common/catalog";
import { UpdateBanner } from "./common/UpdateBanner";
import { GameScreen } from "./game/GameScreen";
import { KingdomsScreen } from "./kingdoms/KingdomsScreen";
import { DataViewer } from "./viewer/DataViewer";

// Routage par hash (spec 13.1 : GitHub Pages ne gère pas les réécritures) :
// #/ = Mes royaumes, #/partie/<id> = partie, #/cartes = visionneuse de données.

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export function App() {
  return (
    <>
      <Screen />
      <UpdateBanner />
    </>
  );
}

function Screen() {
  const hash = useHash();
  const catalog = useCatalog();

  if (hash === "#/cartes") return <DataViewer />;
  if (!catalog) return <p style={{ padding: 24 }}>Chargement des cartes…</p>;
  const game = /^#\/partie\/([\w-]+)$/.exec(hash);
  if (game?.[1]) return <GameScreen key={game[1]} catalog={catalog} kingdomId={game[1]} />;
  return <KingdomsScreen catalog={catalog} />;
}
