import { describe, it, expect } from "vitest";
import { runStaticHarness } from "../src/static-harness.js";
import { DEFAULT_POLICY } from "goalrun-core";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures/skills");

describe("runStaticHarness", () => {
  it("validates a valid skill successfully", () => {
    const diags = runStaticHarness({
      skillDir: resolve(fixturesDir, "valid-skill"),
      policy: DEFAULT_POLICY,
    });
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("reports error for missing SKILL.md", () => {
    const diags = runStaticHarness({
      skillDir: resolve(fixturesDir, "nonexistent"),
      policy: DEFAULT_POLICY,
    });
    expect(diags.some((d) => d.code === "SKILL_MISSING_SKILLMD")).toBe(true);
  });

  it("reports errors for invalid frontmatter", () => {
    const diags = runStaticHarness({
      skillDir: resolve(fixturesDir, "bad-skill"),
      policy: DEFAULT_POLICY,
    });
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("detects secrets in skill body", () => {
    const diags = runStaticHarness({
      skillDir: resolve(fixturesDir, "dangerous-skill"),
      policy: DEFAULT_POLICY,
    });
    const secrets = diags.filter((d) => d.code.startsWith("SECRET_"));
    expect(secrets.length).toBeGreaterThan(0);
  });

  it("detects blocked commands in skill body", () => {
    const diags = runStaticHarness({
      skillDir: resolve(fixturesDir, "dangerous-skill"),
      policy: DEFAULT_POLICY,
    });
    const blocked = diags.filter((d) => d.code === "BLOCKED_COMMAND");
    expect(blocked.length).toBeGreaterThan(0);
  });
});
