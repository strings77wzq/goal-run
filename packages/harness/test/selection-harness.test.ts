import { describe, it, expect } from "vitest";
import { runSelectionHarness, matchSkill } from "../src/selection-harness.js";
import { type SelectionTests, type SelectionTest } from "@strings77wzq/goalrun-core";

const AVAILABLE_SKILLS = ["implementation-strategy", "tdd-change", "code-review"];

describe("matchSkill", () => {
  it("matches bug/fix input to tdd-change", () => {
    const test: SelectionTest = {
      description: "fix a bug",
      input: "fix the login bug",
      expect: { skill: "tdd-change" },
    };
    expect(matchSkill(test, AVAILABLE_SKILLS)).toBe("tdd-change");
  });

  it("matches review input to code-review", () => {
    const test: SelectionTest = {
      description: "review PR",
      input: "review the changes in this PR",
      expect: { skill: "code-review" },
    };
    expect(matchSkill(test, AVAILABLE_SKILLS)).toBe("code-review");
  });

  it("matches design input to implementation-strategy", () => {
    const test: SelectionTest = {
      description: "plan architecture",
      input: "design the new architecture",
      expect: { skill: "implementation-strategy" },
    };
    expect(matchSkill(test, AVAILABLE_SKILLS)).toBe("implementation-strategy");
  });

  it("returns none for unrelated input", () => {
    const test: SelectionTest = {
      description: "readme update",
      input: "update the readme with new badges",
      expect: { skill: "none" },
    };
    expect(matchSkill(test, AVAILABLE_SKILLS)).toBe("none");
  });

  it("respects negative keywords", () => {
    const test: SelectionTest = {
      description: "docs change",
      input: "write documentation for the API",
      expect: { skill: "none" },
      negative_keywords: ["documentation", "docs", "readme"],
    };
    expect(matchSkill(test, AVAILABLE_SKILLS)).toBe("none");
  });
});

describe("runSelectionHarness", () => {
  it("runs all tests and reports results", () => {
    const tests: SelectionTests = {
      tests: [
        { description: "bug fix", input: "fix a bug", expect: { skill: "tdd-change" } },
        { description: "code review", input: "review the PR", expect: { skill: "code-review" } },
        { description: "docs", input: "update docs", expect: { skill: "none" } },
      ],
    };
    const result = runSelectionHarness(tests, AVAILABLE_SKILLS);
    expect(result.summary.total).toBe(3);
    expect(result.summary.passed).toBe(3);
    expect(result.summary.failed).toBe(0);
  });

  it("reports failures for mismatches", () => {
    const tests: SelectionTests = {
      tests: [
        { description: "bug fix", input: "fix a bug", expect: { skill: "code-review" } },
      ],
    };
    const result = runSelectionHarness(tests, AVAILABLE_SKILLS);
    expect(result.summary.failed).toBe(1);
  });
});
