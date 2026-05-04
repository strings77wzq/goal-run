import type { Diagnostic, SelectionTest, SelectionTests } from "@goalrun/core";
import { createError, createWarning, createInfo } from "@goalrun/core";

export interface SelectionResult {
  test: SelectionTest;
  matched: string | "none";
  expected: string;
  passed: boolean;
  diagnostics: Diagnostic[];
}

export interface SelectionHarnessOutput {
  results: SelectionResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export function runSelectionHarness(
  tests: SelectionTests,
  availableSkills: string[],
): SelectionHarnessOutput {
  const results: SelectionResult[] = [];

  for (const test of tests.tests) {
    const matched = matchSkill(test, availableSkills);
    const passed = matched === test.expect.skill;
    results.push({
      test,
      matched,
      expected: test.expect.skill,
      passed,
      diagnostics: passed
        ? []
        : [
            createError(
              "SELECTION_MISMATCH",
              `Expected skill "${test.expect.skill}" but matched "${matched}"`,
              { hint: `Input: "${test.input}"` },
            ),
          ],
    });
  }

  return {
    results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
    },
  };
}

export function matchSkill(test: SelectionTest, availableSkills: string[]): string | "none" {
  const input = test.input.toLowerCase();

  // Explicit mention: if input contains "use X skill" or "install X"
  const explicitPattern = /(?:use|install|apply|run)\s+(?:the\s+)?([\w-]+)\s+skill/i;
  const explicitMatch = explicitPattern.exec(input);
  if (explicitMatch?.[1] && availableSkills.includes(explicitMatch[1])) {
    return explicitMatch[1];
  }

  // Check positive keywords
  if (test.keywords && test.keywords.length > 0) {
    const matchedKeyword = test.keywords.find((kw) => input.includes(kw.toLowerCase()));
    if (matchedKeyword && availableSkills.length > 0) {
      return availableSkills[0]!;
    }
  }

  // Check negative keywords — if found, return none
  if (test.negative_keywords && test.negative_keywords.length > 0) {
    const hasNegative = test.negative_keywords.some((kw) => input.includes(kw.toLowerCase()));
    if (hasNegative) return "none";
  }

  // Simple keyword-based matching with scoring
  const skillKeywords: Record<string, string[]> = {
    "implementation-strategy": ["design", "plan", "architecture", "strategy", "refactor", "major"],
    "tdd-change": ["bug", "fix", "feature", "test", "tdd", "change", "implement", "regression"],
    "code-review": ["review", "audit", "pr", "diff", "inspect", "quality"],
  };

  let bestSkill = "none";
  let bestScore = 0;

  // Priority order for tie-breaking: code-review > tdd-change > implementation-strategy
  const priorityOrder = ["code-review", "tdd-change", "implementation-strategy"];

  for (const [skill, keywords] of Object.entries(skillKeywords)) {
    if (!availableSkills.includes(skill)) continue;
    const score = keywords.filter((kw) => input.includes(kw)).length;
    if (
      score > bestScore ||
      (score === bestScore && bestScore > 0 &&
        priorityOrder.indexOf(skill) < priorityOrder.indexOf(bestSkill))
    ) {
      bestScore = score;
      bestSkill = skill;
    }
  }

  return bestSkill;
}
