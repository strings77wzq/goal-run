import { createWarning, createInfo, type Diagnostic } from "@strings77wzq/goalrun-core";

const AMBIGUOUS_TERMS = [
  "better",
  "improve",
  "fix",
  "enhance",
  "optimize",
  "clean up",
  "refactor",
  "update",
  "change",
  "adjust",
];

const UNVERIFIABLE_TERMS = [
  "clean",
  "nice",
  "good",
  "proper",
  "robust",
  "elegant",
  "simple",
  "easy",
  "intuitive",
  "maintainable",
  "scalable",
  "flexible",
  "well-designed",
  "well-structured",
  "well-documented",
];

const ERROR_PATH_KEYWORDS = ["error", "invalid", "failure", "exception", "edge case", "boundary", "timeout", "null", "undefined"];
const REGRESSION_KEYWORDS = ["regression", "existing", "unchanged", "still pass", "no break", "compatible"];

function hasNumericMetric(text: string): boolean {
  return /[<>≤≥]\s*\d+|\d+\s*(?:ms|s|min|%|rps|rpm|bytes|mb|gb)/i.test(text);
}

export function detectAmbiguity(text: string, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lower = text.toLowerCase();

  for (const term of AMBIGUOUS_TERMS) {
    if (lower.includes(term) && !hasNumericMetric(text)) {
      diagnostics.push(
        createWarning(
          "CRITERIA_VAGUE",
          `Criterion contains vague term "${term}" without measurable target`,
          {
            file: filePath,
            hint: `Replace "${term}" with a specific measurable outcome (e.g., "response time < 200ms" instead of "improve performance")`,
          },
        ),
      );
      break;
    }
  }

  return diagnostics;
}

export function detectUnverifiable(text: string, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lower = text.toLowerCase();

  for (const term of UNVERIFIABLE_TERMS) {
    if (new RegExp(`\\b${term}\\b`, "i").test(lower)) {
      diagnostics.push(
        createWarning(
          "CRITERIA_UNVERIFIABLE",
          `Criterion uses subjective term "${term}" — not objectively verifiable`,
          {
            file: filePath,
            hint: `Replace "${term}" with a testable condition (e.g., "all functions have typed parameters" instead of "code is clean")`,
          },
        ),
      );
      break;
    }
  }

  return diagnostics;
}

export function checkCompleteness(criteria: string[], filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const allText = criteria.join(" ").toLowerCase();

  // Check for error/edge case handling
  const hasErrorPath = ERROR_PATH_KEYWORDS.some((kw) => allText.includes(kw));
  if (!hasErrorPath) {
    diagnostics.push(
      createInfo(
        "CRITERIA_MISSING_ERROR_PATH",
        "No criteria cover error or edge case handling",
        {
          file: filePath,
          hint: "Consider adding: 'invalid inputs produce clear error messages' or 'edge case X handled correctly'",
        },
      ),
    );
  }

  // Check for regression
  const hasRegression = REGRESSION_KEYWORDS.some((kw) => allText.includes(kw));
  if (!hasRegression) {
    diagnostics.push(
      createInfo(
        "CRITERIA_MISSING_REGRESSION",
        "No criteria cover regression prevention",
        {
          file: filePath,
          hint: "Consider adding: 'existing tests continue to pass' or 'no regression in behavior X'",
        },
      ),
    );
  }

  return diagnostics;
}

export function checkCriteriaQuality(criteria: string[], filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const criterion of criteria) {
    diagnostics.push(...detectAmbiguity(criterion, filePath));
    diagnostics.push(...detectUnverifiable(criterion, filePath));
  }

  diagnostics.push(...checkCompleteness(criteria, filePath));

  return diagnostics;
}
