import { describe, it, expect } from "vitest";
import {
  validatePolicyConfig,
  checkGoalAgainstPolicy,
  checkSkillPermissions,
} from "../src/policy-checker.js";
import type { PolicyConfig } from "@strings77wzq/goalrun-core";

const SAMPLE_POLICY: PolicyConfig = {
  blocked_commands: ["rm -rf", "npm publish", "terraform apply"],
  require_approval_for: [
    "changes_public_api",
    "deletes_files",
    "modifies_auth_code",
  ],
};

describe("validatePolicyConfig", () => {
  it("returns empty diagnostics for valid policy", () => {
    const result = validatePolicyConfig(SAMPLE_POLICY, "policy.yaml");
    expect(result.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("warns on empty blocked_commands", () => {
    const config = { blocked_commands: [], require_approval_for: ["x"] };
    const result = validatePolicyConfig(config, "policy.yaml");
    expect(result.some((d) => d.code === "POLICY_NO_BLOCKED_COMMANDS")).toBe(true);
  });

  it("warns on empty require_approval_for", () => {
    const config = { blocked_commands: ["rm -rf"], require_approval_for: [] };
    const result = validatePolicyConfig(config, "policy.yaml");
    expect(result.some((d) => d.code === "POLICY_NO_APPROVAL_GATES")).toBe(true);
  });
});

describe("checkGoalAgainstPolicy", () => {
  it("returns empty for goal with known approval gates", () => {
    const result = checkGoalAgainstPolicy(
      ["changes_public_api", "deletes_files"],
      SAMPLE_POLICY,
      "goal.yaml",
    );
    expect(result.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("errors on unknown approval gate", () => {
    const result = checkGoalAgainstPolicy(
      ["changes_public_api", "unknown_gate"],
      SAMPLE_POLICY,
      "goal.yaml",
    );
    const err = result.find((d) => d.code === "GOAL_UNKNOWN_APPROVAL_GATE");
    expect(err).toBeDefined();
    expect(err!.severity).toBe("error");
  });

  it("returns empty for empty goal approval list", () => {
    const result = checkGoalAgainstPolicy([], SAMPLE_POLICY, "goal.yaml");
    expect(result.filter((d) => d.severity === "error")).toHaveLength(0);
  });
});

describe("checkSkillPermissions", () => {
  it("returns empty for valid permissions", () => {
    const result = checkSkillPermissions(
      "test-skill",
      ["read_files", "write_files", "run_tests"],
      "test/SKILL.md",
    );
    expect(result).toHaveLength(0);
  });

  it("warns on missing permissions", () => {
    const result = checkSkillPermissions("bad-skill", [], "bad/SKILL.md");
    expect(result.some((d) => d.code === "SKILL_NO_PERMISSIONS")).toBe(true);
  });

  it("warns on dangerous permission patterns", () => {
    const result = checkSkillPermissions(
      "risky",
      ["execute_shell_commands", "delete_files"],
      "risky/SKILL.md",
    );
    expect(result.some((d) => d.code === "SKILL_DANGEROUS_PERMISSION")).toBe(true);
  });
});
