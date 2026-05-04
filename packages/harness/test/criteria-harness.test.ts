import { describe, it, expect } from "vitest";
import {
  checkCriteriaQuality,
  detectAmbiguity,
  detectUnverifiable,
  checkCompleteness,
} from "../src/criteria-harness.js";

describe("detectAmbiguity", () => {
  it("detects vague improvement terms", () => {
    const diags = detectAmbiguity("make it better", "goal.yaml");
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((d) => d.code === "CRITERIA_VAGUE")).toBe(true);
    expect(diags.some((d) => d.message.includes("better"))).toBe(true);
  });

  it("detects 'fix' without specifics", () => {
    const diags = detectAmbiguity("fix the bug", "goal.yaml");
    expect(diags.some((d) => d.code === "CRITERIA_VAGUE")).toBe(true);
  });

  it("detects 'improve' without metrics", () => {
    const diags = detectAmbiguity("improve performance", "goal.yaml");
    expect(diags.some((d) => d.code === "CRITERIA_VAGUE")).toBe(true);
  });

  it("accepts specific measurable criteria", () => {
    const diags = detectAmbiguity("response time under 200ms for all endpoints", "goal.yaml");
    expect(diags.filter((d) => d.code === "CRITERIA_VAGUE")).toHaveLength(0);
  });

  it("accepts criteria with quantitative metrics", () => {
    const diags = detectAmbiguity("test coverage above 80%", "goal.yaml");
    expect(diags.filter((d) => d.code === "CRITERIA_VAGUE")).toHaveLength(0);
  });
});

describe("detectUnverifiable", () => {
  it("detects subjective quality terms", () => {
    const diags = detectUnverifiable("code is clean", "goal.yaml");
    expect(diags.some((d) => d.code === "CRITERIA_UNVERIFIABLE")).toBe(true);
  });

  it("detects 'good' as unverifiable", () => {
    const diags = detectUnverifiable("good error handling", "goal.yaml");
    expect(diags.some((d) => d.code === "CRITERIA_UNVERIFIABLE")).toBe(true);
  });

  it("detects 'nice' as unverifiable", () => {
    const diags = detectUnverifiable("nice to have logging", "goal.yaml");
    expect(diags.some((d) => d.code === "CRITERIA_UNVERIFIABLE")).toBe(true);
  });

  it("accepts verifiable criteria", () => {
    const diags = detectUnverifiable("all API endpoints return 2xx for valid inputs", "goal.yaml");
    expect(diags.filter((d) => d.code === "CRITERIA_UNVERIFIABLE")).toHaveLength(0);
  });
});

describe("checkCompleteness", () => {
  it("suggests error path criterion when missing", () => {
    const criteria = ["happy path works correctly"];
    const diags = checkCompleteness(criteria, "goal.yaml");
    expect(diags.some((d) => d.code === "CRITERIA_MISSING_ERROR_PATH")).toBe(true);
  });

  it("suggests regression criterion when missing", () => {
    const criteria = ["new feature works"];
    const diags = checkCompleteness(criteria, "goal.yaml");
    expect(diags.some((d) => d.code === "CRITERIA_MISSING_REGRESSION")).toBe(true);
  });

  it("accepts criteria covering error and regression", () => {
    const criteria = [
      "happy path returns correct result",
      "invalid input returns 400 error",
      "existing tests continue to pass",
    ];
    const diags = checkCompleteness(criteria, "goal.yaml");
    expect(diags.filter((d) => d.code.startsWith("CRITERIA_MISSING_"))).toHaveLength(0);
  });

  it("returns empty for comprehensive criteria sets", () => {
    const criteria = [
      "correct result for valid inputs",
      "proper error for invalid edge case",
      "no regression in existing suite",
    ];
    const diags = checkCompleteness(criteria, "goal.yaml");
    expect(diags.filter((d) => d.severity === "warning")).toHaveLength(0);
  });
});

describe("checkCriteriaQuality", () => {
  it("returns combined diagnostics from all checks", () => {
    const criteria = ["make it better", "code is clean"];
    const diags = checkCriteriaQuality(criteria, "goal.yaml");
    expect(diags.length).toBeGreaterThan(0);
    // Should include ambiguity, unverifiability, and completeness warnings
    const codes = new Set(diags.map((d) => d.code));
    expect(codes.has("CRITERIA_VAGUE")).toBe(true);
    expect(codes.has("CRITERIA_UNVERIFIABLE")).toBe(true);
  });

  it("returns empty for high-quality criteria", () => {
    const criteria = [
      "response time < 200ms p95 for all endpoints",
      "error rate < 0.1% under 1000 RPS load",
      "all existing tests continue to pass",
      "invalid inputs return 400 with descriptive error message",
    ];
    const diags = checkCriteriaQuality(criteria, "goal.yaml");
    expect(diags.filter((d) => d.severity === "warning")).toHaveLength(0);
  });
});
