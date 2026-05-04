import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runGoalHarness } from "../src/goal-harness.js";
import { DEFAULT_POLICY } from "@strings77wzq/goalrun-core";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

describe("runGoalHarness", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "goalrun-goal-harness-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("validates a valid goal spec", () => {
    const goalPath = resolve(tmpDir, "valid-goal.yaml");
    writeFileSync(
      goalPath,
      `
id: test-goal
title: Test Goal
goal: Run a test goal with valid configuration
skills:
  - tdd-change
  - code-review
criteria:
  - all tests pass
  - code is reviewed
budget:
  max_iterations: 5
  max_changed_files: 20
  max_runtime_minutes: 60
policy:
  require_approval_for:
    - changes_public_api
verification:
  commands:
    - pnpm test
`,
    );

    const result = runGoalHarness({
      goalYamlPath: goalPath,
      policy: DEFAULT_POLICY,
      availableSkills: ["tdd-change", "code-review"],
    });

    expect(result.success).toBe(true);
    expect(result.spec?.id).toBe("test-goal");
  });

  it("errors on missing skill reference", () => {
    const goalPath = resolve(tmpDir, "missing-skill.yaml");
    writeFileSync(
      goalPath,
      `
id: test-goal
title: Test
goal: Test with missing skill
skills:
  - nonexistent-skill
criteria:
  - tests pass
budget:
  max_iterations: 5
  max_changed_files: 20
  max_runtime_minutes: 60
policy:
  require_approval_for: []
verification:
  commands:
    - pnpm test
`,
    );

    const result = runGoalHarness({
      goalYamlPath: goalPath,
      policy: DEFAULT_POLICY,
      availableSkills: ["tdd-change"],
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "GOAL_MISSING_SKILL")).toBe(true);
  });

  it("detects dangerous instructions in goal text", () => {
    const goalPath = resolve(tmpDir, "dangerous-goal.yaml");
    writeFileSync(
      goalPath,
      `
id: test-goal
title: Test
goal: Run rm -rf / to clean up the system
skills:
  - tdd-change
criteria:
  - system cleaned
budget:
  max_iterations: 5
  max_changed_files: 20
  max_runtime_minutes: 60
policy:
  require_approval_for: []
verification:
  commands:
    - echo done
`,
    );

    const result = runGoalHarness({
      goalYamlPath: goalPath,
      policy: DEFAULT_POLICY,
      availableSkills: ["tdd-change"],
    });

    expect(result.diagnostics.some((d) => d.code === "GOAL_DANGEROUS_RM")).toBe(true);
  });

  it("errors when goal file not found", () => {
    const result = runGoalHarness({
      goalYamlPath: "/nonexistent/goal.yaml",
      policy: DEFAULT_POLICY,
      availableSkills: [],
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "GOAL_FILE_NOT_FOUND")).toBe(true);
  });
});
