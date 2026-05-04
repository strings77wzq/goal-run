import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import type { Diagnostic } from './diagnostic.js';
import { createError } from './diagnostic.js';

export const BudgetSchema = z.object({
  max_iterations: z.number().int().positive(),
  max_changed_files: z.number().int().positive(),
  max_runtime_minutes: z.number().int().positive(),
});

export const PolicyGateSchema = z.object({
  require_approval_for: z.array(z.string()),
});

export const VerificationSchema = z.object({
  commands: z.array(z.string()).min(1),
});

export const GoalSpecSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  skills: z.array(z.string()).min(1),
  criteria: z.array(z.string()).min(1),
  budget: BudgetSchema,
  policy: PolicyGateSchema,
  verification: VerificationSchema,
});

export type GoalSpec = z.infer<typeof GoalSpecSchema>;

export interface GoalParseSuccess {
  success: true;
  spec: GoalSpec;
  diagnostics: Diagnostic[];
}

export interface GoalParseFailure {
  success: false;
  diagnostics: Diagnostic[];
}

export type GoalParseResult = GoalParseSuccess | GoalParseFailure;

export function parseGoalSpec(yamlContent: string, filePath: string): GoalParseResult {
  let raw: unknown;

  try {
    raw = parseYaml(yamlContent);
  } catch (err) {
    return {
      success: false,
      diagnostics: [
        createError('GOAL_INVALID_YAML', `Failed to parse YAML in ${filePath}: ${String(err)}`, {
          file: filePath,
        }),
      ],
    };
  }

  if (
    raw === null ||
    raw === undefined ||
    (typeof raw === 'object' && Object.keys(raw).length === 0)
  ) {
    return {
      success: false,
      diagnostics: [
        createError('GOAL_EMPTY', `Empty or null goal spec in ${filePath}`, {
          file: filePath,
          hint: 'Add a valid goal specification with id, title, goal, skills, criteria, budget, policy, and verification',
        }),
      ],
    };
  }

  const parsed = GoalSpecSchema.safeParse(raw);

  if (!parsed.success) {
    const diags = parsed.error.issues.map((issue) =>
      createError('GOAL_INVALID_SCHEMA', `${issue.path.join('.')}: ${issue.message}`, {
        file: filePath,
      }),
    );
    return { success: false, diagnostics: diags };
  }

  return { success: true, spec: parsed.data, diagnostics: [] };
}
