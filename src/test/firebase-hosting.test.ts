// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(new URL("../../firebase.json", import.meta.url), "utf8"));

describe("Firebase Hosting statis", () => {
  it("menyajikan hasil build dari dist", () => {
    expect(config.hosting.public).toBe("dist");
  });

  it("mengarahkan seluruh halaman ke entry SPA index.html", () => {
    expect(config.hosting.rewrites).toEqual([{ source: "**", destination: "/index.html" }]);
  });

  it("tidak memakai fungsi atau runtime SSR untuk frontend", () => {
    expect(config.hosting).not.toHaveProperty("frameworksBackend");
    for (const rewrite of config.hosting.rewrites) {
      expect(rewrite).not.toHaveProperty("function");
      expect(rewrite).not.toHaveProperty("run");
    }
  });
});