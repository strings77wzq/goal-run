import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import type { Diagnostic } from './diagnostic.js';
import { createError } from './diagnostic.js';

// ── 8-Stage SDD Pipeline ──

export const PIPELINE_STAGES = [
  'change', // Clarify vague idea into change proposal
  'requirement', // Transform proposal into executable requirements with AC
  'design', // Technical design with ADRs and risk analysis
  'task', // Break design into atomic tasks with verify commands
  'dev', // Execute tasks with TDD Red-Green-Refactor
  'test', // Derive test matrix from AC, run UAT
  'review', // Multi-round review (spec compliance + code quality)
  'integration', // UAT, failure diagnosis, lessons learned, archival
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PipelineStageSchema = z.enum(PIPELINE_STAGES);

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

// ── File boundary constraint ──

export const FileBoundarySchema = z.object({
  read_files: z.array(z.string()).optional(),
  write_files: z.array(z.string()).optional(),
});

// ── Task specification (for task stage) ──

export const TaskSpecSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  verify_command: z.string().min(1),
  file_boundaries: FileBoundarySchema.optional(),
  depends_on: z.array(z.string()).optional(),
});

// ── Architecture Decision Record ──

export const ADRSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  context: z.string().min(1),
  decision: z.string().min(1),
  consequences: z.string().min(1),
});

// ── Acceptance criterion with Given/When/Then ──

export const AcceptanceCriterionSchema = z.object({
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
});

// ── Ecosystem integration requirements ──

export const EcosystemSchema = z.object({
  superpowers: z.boolean().optional(),
  omc: z.boolean().optional(),
  openspec: z.boolean().optional(),
  gstack: z.boolean().optional(),
  ecc: z.boolean().optional(),
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
  // New fields for full pipeline support
  pipeline_stage: PipelineStageSchema.optional(),
  tasks: z.array(TaskSpecSchema).optional(),
  acceptance_criteria: z.array(AcceptanceCriterionSchema).optional(),
  adrs: z.array(ADRSchema).optional(),
  ecosystem: EcosystemSchema.optional(),
});

export type GoalSpec = z.infer<typeof GoalSpecSchema>;
export type TaskSpec = z.infer<typeof TaskSpecSchema>;
export type ADR = z.infer<typeof ADRSchema>;
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
export type FileBoundary = z.infer<typeof FileBoundarySchema>;
export type EcosystemConfig = z.infer<typeof EcosystemSchema>;

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
