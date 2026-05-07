import type { Diagnostic } from 'goalrun-core';
import type { SelectionHarnessOutput } from './selection-harness.js';

export interface ReportSummary {
  totalDiagnostics: number;
  errors: number;
  warnings: number;
  infos: number;
  files: string[];
}

export interface PlanReport {
  goalId: string;
  goalTitle: string;
  selectedSkills: string[];
  policyGates: string[];
  verificationChecklist: string[];
  riskSummary: string[];
  diagnostics: Diagnostic[];
  agentPrompt: string;
}

export interface VerifyReport {
  goalId?: string;
  staticHarness: Diagnostic[];
  selectionHarness?: SelectionHarnessOutput;
  goalHarness: Diagnostic[];
  policyHarness: Diagnostic[];
  summary: ReportSummary;
  passed: boolean;
}

export function summarizeDiagnostics(diagnostics: Diagnostic[]): ReportSummary {
  const files = new Set<string>();
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const d of diagnostics) {
    if (d.file) files.add(d.file);
    if (d.severity === 'error') errors++;
    else if (d.severity === 'warning') warnings++;
    else infos++;
  }

  return {
    totalDiagnostics: diagnostics.length,
    errors,
    warnings,
    infos,
    files: [...files],
  };
}

export function mergeSummaries(...summaries: ReportSummary[]): ReportSummary {
  const files = new Set<string>();
  let totalDiagnostics = 0;
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const s of summaries) {
    totalDiagnostics += s.totalDiagnostics;
    errors += s.errors;
    warnings += s.warnings;
    infos += s.infos;
    for (const f of s.files) files.add(f);
  }

  return { totalDiagnostics, errors, warnings, infos, files: [...files] };
}

export function generatePlanReport(
  goalId: string,
  goalTitle: string,
  selectedSkills: string[],
  policyGates: string[],
  verificationChecklist: string[],
  riskSummary: string[],
  diagnostics: Diagnostic[],
): PlanReport {
  const promptLines = [
    `# Engineering Task: ${goalTitle}`,
    ``,
    `## Goal ID: ${goalId}`,
    ``,
    `## Skills to Use (in order)`,
    ...selectedSkills.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `## Policy Gates`,
    ...policyGates.map((g) => `- [ ] ${g}`),
    ``,
    `## Verification Checklist`,
    ...verificationChecklist.map((c) => `- [ ] ${c}`),
    ``,
    `## Risk Summary`,
    ...(riskSummary.length > 0
      ? riskSummary.map((r) => `- ${r}`)
      : ['No risks identified.']),
    ``,
    `## Instructions`,
    `1. Read and internalize each skill's SKILL.md before starting`,
    `2. Follow the skill workflow in order`,
    `3. Stop at each policy gate and request approval before proceeding`,
    `4. Run verification commands after each change`,
    `5. Do not modify files outside the scope of this goal`,
    `6. Do not execute blocked commands`,
  ];

  return {
    goalId,
    goalTitle,
    selectedSkills,
    policyGates,
    verificationChecklist,
    riskSummary,
    diagnostics,
    agentPrompt: promptLines.join('\n'),
  };
}

export function deriveRiskSummary(
  budget: { max_iterations: number; max_changed_files: number; max_runtime_minutes: number },
  approvalGates: string[],
  diagnostics: Diagnostic[],
): string[] {
  const risks: string[] = [];

  if (budget.max_iterations > 10) {
    risks.push(`High iteration budget (${budget.max_iterations}) — consider reducing`);
  }
  if (budget.max_changed_files > 50) {
    risks.push(`High file change budget (${budget.max_changed_files}) — wide blast radius`);
  }
  if (approvalGates.length === 0) {
    risks.push('No approval gates defined — all changes may proceed without approval');
  }
  if (approvalGates.includes('changes_public_api')) {
    risks.push('Public API changes require approval');
  }
  if (approvalGates.includes('deletes_files')) {
    risks.push('File deletion requires approval');
  }
  if (approvalGates.includes('modifies_auth_code')) {
    risks.push('Authentication code changes require approval');
  }

  const errors = diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    risks.push(`${errors.length} validation error(s) — review before proceeding`);
  }

  return risks;
}
