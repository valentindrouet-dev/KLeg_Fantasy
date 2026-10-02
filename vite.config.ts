import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import pkg from "./package.json";

// base = nom exact du dépôt GitHub (sensible à la casse), voir spec section 13.1
export default defineConfig({
  base: "/KLeg_Fantasy/",
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) }, // affiché dans l'appli (src/version.ts)
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
