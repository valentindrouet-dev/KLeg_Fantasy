import { describe, expect, it } from "vitest";
import { formatVersion } from "../../src/version";
import pkg from "../../package.json";

describe("version affichée", () => {
  it("0.5.0 s'affiche v0.05, un correctif 0.5.1 s'affiche v0.05.1", () => {
    expect(formatVersion("0.5.0")).toBe("v0.05");
    expect(formatVersion("0.5.1")).toBe("v0.05.1");
    expect(formatVersion("1.12.0")).toBe("v1.12");
  });

  it("le journal des versions décrit la version de package.json", async () => {
    const { readFile } = await import("node:fs/promises");
    expect(await readFile("CHANGELOG.md", "utf8")).toContain(`## ${formatVersion(pkg.version)} `);
  });
});
