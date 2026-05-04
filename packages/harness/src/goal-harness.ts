import {
  parseGoalSpec,
  type Diagnostic,
  type GoalSpec,
  createError,
  createWarning,
} from "@goalrun/core";
import { scanForBlockedCommands } from "@goalrun/security";
import type { PolicyConfig } from "@goalrun/core";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { checkCriteriaQuality } from "./criteria-harness.js";

export interface GoalHarnessInput {
  goalYamlPath: string;
  policy: PolicyConfig;
  availableSkills: string[];
}

export interface GoalHarnessOutput {
  success: boolean;
  spec?: GoalSpec;
  diagnostics: Diagnostic[];
}

export function runGoalHarness(input: GoalHarnessInput): GoalHarnessOutput {
  const diagnostics: Diagnostic[] = [];

  if (!existsSync(input.goalYamlPath)) {
    diagnostics.push(
      createError("GOAL_FILE_NOT_FOUND", `Goal file not found: ${input.goalYamlPath}`, {
        file: input.goalYamlPath,
      }),
    );
    return { success: false, diagnostics };
  }

  const content = readFileSync(input.goalYamlPath, "utf-8");
  const parsed = parseGoalSpec(content, input.goalYamlPath);

  if (!parsed.success) {
    return { success: false, diagnostics: parsed.diagnostics };
  }

  const { spec } = parsed;

  // Check referenced skills exist
  for (const skill of spec.skills) {
    if (!input.availableSkills.includes(skill)) {
      diagnostics.push(
        createError(
          "GOAL_MISSING_SKILL",
          `Goal references skill "${skill}" which is not installed`,
          {
            file: input.goalYamlPath,
            hint: `Run "goalrun skill install ${skill}" or check the skill name`,
          },
        ),
      );
    }
  }

  // Check budget values are reasonable
  if (spec.budget.max_iterations > 100) {
    diagnostics.push(
      createWarning(
        "GOAL_HIGH_ITERATIONS",
        `max_iterations (${spec.budget.max_iterations}) seems high`,
        { file: input.goalYamlPath, hint: "Consider reducing to prevent runaway loops" },
      ),
    );
  }

  if (spec.budget.max_changed_files > 500) {
    diagnostics.push(
      createWarning(
        "GOAL_HIGH_CHANGED_FILES",
        `max_changed_files (${spec.budget.max_changed_files}) seems high`,
        { file: input.goalYamlPath },
      ),
    );
  }

  // Check goal text for dangerous instructions
  const dangerPatterns = [
    { pattern: /rm\s+-rf/i, code: "GOAL_DANGEROUS_RM", msg: "Goal text contains rm -rf" },
    { pattern: /curl\s+.*\|\s*(?:ba)?sh/i, code: "GOAL_DANGEROUS_CURL", msg: "Goal text contains curl pipe to shell" },
    { pattern: /DROP\s+TABLE/i, code: "GOAL_DANGEROUS_SQL", msg: "Goal text contains DROP TABLE" },
    { pattern: /chmod\s+777/i, code: "GOAL_DANGEROUS_PERM", msg: "Goal text contains chmod 777" },
  ];

  for (const dp of dangerPatterns) {
    if (dp.pattern.test(spec.goal)) {
      diagnostics.push(
        createError(dp.code, dp.msg, {
          file: input.goalYamlPath,
          hint: "Remove dangerous instructions from the goal specification",
        }),
      );
    }
  }

  // Check verification commands don't contain blocked commands
  const allVerificationCommands = spec.verification.commands.join("\n");
  const blockedDiags = scanForBlockedCommands(
    allVerificationCommands,
    input.goalYamlPath,
    input.policy.blocked_commands,
  );
  diagnostics.push(...blockedDiags);

  // Run criteria quality harness
  const criteriaDiags = checkCriteriaQuality(spec.criteria, input.goalYamlPath);
  diagnostics.push(...criteriaDiags);

  const hasErrors = diagnostics.some((d) => d.severity === "error");
  return { success: !hasErrors, spec, diagnostics };
}
