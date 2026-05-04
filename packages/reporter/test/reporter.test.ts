import { describe, it, expect } from "vitest";
import { formatText, formatJson } from "../src/format.js";
import { createError, createWarning, createInfo } from "goalrun-core";

describe("formatText", () => {
  it("returns 'All checks passed' for empty diagnostics", () => {
    const output = formatText([]);
    expect(output).toContain("passed");
  });

  it("includes error count", () => {
    const diags = [createError("E001", "broken")];
    const output = formatText(diags);
    expect(output).toContain("1 error");
  });

  it("includes warning count", () => {
    const diags = [createWarning("W001", "careful")];
    const output = formatText(diags);
    expect(output).toContain("1 warning");
  });

  it("includes diagnostic code in output", () => {
    const diags = [createError("E001", "something broke", { file: "a.ts", line: 10 })];
    const output = formatText(diags);
    expect(output).toContain("E001");
    expect(output).toContain("something broke");
    expect(output).toContain("a.ts");
  });

  it("handles mixed severities", () => {
    const diags = [
      createError("E1", "err"),
      createWarning("W1", "warn"),
      createInfo("I1", "info"),
    ];
    const output = formatText(diags);
    expect(output).toContain("1 error");
    expect(output).toContain("1 warning");
  });
});

describe("formatJson", () => {
  it("returns valid JSON with summary", () => {
    const diags = [createError("E001", "broken", { file: "a.ts" })];
    const json = formatJson(diags);
    const parsed = JSON.parse(json);
    expect(parsed.summary.errors).toBe(1);
    expect(parsed.diagnostics[0].code).toBe("E001");
    expect(parsed.diagnostics[0].message).toBe("broken");
    expect(parsed.diagnostics[0].file).toBe("a.ts");
  });

  it("handles empty diagnostics", () => {
    const json = formatJson([]);
    const parsed = JSON.parse(json);
    expect(parsed.summary.errors).toBe(0);
    expect(parsed.diagnostics).toHaveLength(0);
  });

  it("excludes undefined fields", () => {
    const diags = [createError("E001", "msg")];
    const json = formatJson(diags);
    const parsed = JSON.parse(json);
    expect(parsed.diagnostics[0].file).toBeUndefined();
  });
});
