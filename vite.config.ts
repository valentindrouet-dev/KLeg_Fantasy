import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";
import pkg from "./package.json";

/** Publie version.json à côté du site : l'appli le consulte pour proposer la mise à jour (src/ui/common/UpdateBanner.tsx). */
function versionFile(): Plugin {
  return {
    name: "version-file",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: pkg.version }) });
    },
  };
}

// base = nom exact du dépôt GitHub (sensible à la casse), voir spec section 13.1
export default defineConfig({
  base: "/KLeg_Fantasy/",
  plugins: [react(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) }, // affiché dans l'appli (src/version.ts)
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
