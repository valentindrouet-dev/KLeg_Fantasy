import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DataViewer } from "./ui/viewer/DataViewer";
import "./ui/theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("Élément #root introuvable");

// P0 : la visionneuse de données est le seul écran. Le routage par hash arrive en P2.
createRoot(root).render(
  <StrictMode>
    <DataViewer />
  </StrictMode>,
);
