import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { requestPersistentStorage } from "./persistence/db";
import { applyZoom, usePrefs } from "./ui/common/prefs";
import "./ui/theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("Élément #root introuvable");

void requestPersistentStorage();
applyZoom(usePrefs.getState().zoom); // spec 7.6 bis : éviter que Safari efface les sauvegardes

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
