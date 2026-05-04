import { describe, it, expect } from "vitest";
import {
  summarizeDiagnostics,
  mergeSummaries,
  generatePlanReport,
} from "../src/report-harness.js";
import { createError, createWarning, createInfo } from "goalrun-core";

describe("summarizeDiagnostics", () => {
  it("counts diagnostic severities", () => {
    const diags = [
      createError("E1", "error 1", { file: "a.ts", line: 1 }),
      createError("E2", "error 2", { file: "b.ts", line: 2 }),
      createWarning("W1", "warning 1", { file: "a.ts" }),
      createInfo("I1", "info 1"),
    ];

    const summary = summarizeDiagnostics(diags);
    expect(summary.totalDiagnostics).toBe(4);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
    expect(summary.infos).toBe(1);
    expect(summary.files).toHaveLength(2);
  });

  it("returns zero counts for empty array", () => {
    const summary = summarizeDiagnostics([]);
    expect(summary.totalDiagnostics).toBe(0);
    expect(summary.errors).toBe(0);
  });
});

describe("mergeSummaries", () => {
  it("merges multiple summaries", () => {
    const s1 = { totalDiagnostics: 3, errors: 1, warnings: 1, infos: 1, files: ["a.ts"] };
    const s2 = { totalDiagnostics: 2, errors: 0, warnings: 1, infos: 1, files: ["b.ts"] };

    const merged = mergeSummaries(s1, s2);
    expect(merged.totalDiagnostics).toBe(5);
    expect(merged.errors).toBe(1);
    expect(merged.warnings).toBe(2);
    expect(merged.files).toHaveLength(2);
  });
});

describe("generatePlanReport", () => {
  it("generates a plan report with agent prompt", () => {
    const report = generatePlanReport(
      "test-goal",
      "Test Goal",
      ["tdd-change", "code-review"],
      ["changes_public_api"],
      ["pnpm test", "pnpm typecheck"],
      ["Moderate risk: changes to public API"],
      [],
    );

    expect(report.goalId).toBe("test-goal");
    expect(report.selectedSkills).toHaveLength(2);
    expect(report.agentPrompt).toContain("Test Goal");
    expect(report.agentPrompt).toContain("tdd-change");
    expect(report.agentPrompt).toContain("code-review");
    expect(report.agentPrompt).toContain("## Policy Gates");
    expect(report.agentPrompt).toContain("## Verification Checklist");
  });
});
