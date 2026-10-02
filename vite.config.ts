import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// base = nom exact du dépôt GitHub (sensible à la casse), voir spec section 13.1
export default defineConfig({
  base: "/KLeg_Fantasy/",
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
