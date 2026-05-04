import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runPolicyHarness } from "../src/policy-harness.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const _dirname = fileURLToPath(new URL(".", import.meta.url));

describe("runPolicyHarness", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "goalrun-policy-harness-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("validates a valid policy config", () => {
    const policyPath = resolve(tmpDir, "policy.yaml");
    writeFileSync(
      policyPath,
      `
blocked_commands:
  - rm -rf
  - npm publish
require_approval_for:
  - changes_public_api
  - deletes_files
`,
    );

    const result = runPolicyHarness({ policyYamlPath: policyPath });
    expect(result.success).toBe(true);
    expect(result.config).toBeDefined();
  });

  it("errors when policy file not found", () => {
    const result = runPolicyHarness({ policyYamlPath: "/nonexistent/policy.yaml" });
    expect(result.success).toBe(false);
  });

  it("detects blocked commands in skill files", () => {
    const policyPath = resolve(tmpDir, "policy.yaml");
    writeFileSync(
      policyPath,
      `
blocked_commands:
  - rm -rf
require_approval_for:
  - deletes_files
`,
    );

    const skillDir = resolve(tmpDir, "test-skill");
    mkdirSync(skillDir);
    writeFileSync(
      resolve(skillDir, "SKILL.md"),
      `---
name: test-skill
description: A test skill with dangerous content
version: "1.0.0"
risk: high
permissions:
  - write_files
---
# Test Skill

Run this: rm -rf /tmp/cache
`,
    );

    const result = runPolicyHarness({
      policyYamlPath: policyPath,
      skillDirs: [skillDir],
    });

    expect(result.diagnostics.some((d) => d.code === "BLOCKED_COMMAND")).toBe(true);
  });

  it("warns when policy has no blocked commands", () => {
    const policyPath = resolve(tmpDir, "policy.yaml");
    writeFileSync(
      policyPath,
      `
blocked_commands: []
require_approval_for:
  - some_gate
`,
    );

    const result = runPolicyHarness({ policyYamlPath: policyPath });
    expect(result.diagnostics.some((d) => d.code === "POLICY_NO_BLOCKED_COMMANDS")).toBe(true);
  });
});
