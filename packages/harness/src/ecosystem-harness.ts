import type { Diagnostic, GoalSpec, EcosystemDetection } from 'goalrun-core';
import { createWarning, createInfo } from 'goalrun-core';

/**
 * Skill-to-ecosystem mapping.
 * Defines which ecosystem components are recommended/required for each skill.
 */
const SKILL_ECOSYSTEM_MAP: Record<
  string,
  { component: keyof EcosystemDetection; required: boolean; reason: string }
> = {
  'tdd-change': {
    component: 'superpowers',
    required: false,
    reason: 'Superpowers provides enhanced TDD workflow with red-green-refactor enforcement',
  },
  'implementation-strategy': {
    component: 'openspec',
    required: false,
    reason:
      'OpenSpec provides structured change lifecycle tracking (explore → propose → apply → archive)',
  },
  'code-review': {
    component: 'superpowers',
    required: false,
    reason: 'Superpowers provides verification-before-completion and requesting-code-review skills',
  },
};

/**
 * Goal-to-ecosystem mapping.
 * Defines which ecosystem components are recommended based on goal characteristics.
 */
const GOAL_ECOSYSTEM_CHECKS: {
  check: (spec: GoalSpec) => boolean;
  component: keyof EcosystemDetection;
  required: boolean;
  reason: string;
}[] = [
  {
    check: (spec) => spec.pipeline_stage !== undefined,
    component: 'openspec',
    required: false,
    reason: 'Goal uses pipeline stages — OpenSpec provides structured stage management',
  },
  {
    check: (spec) => spec.acceptance_criteria !== undefined && spec.acceptance_criteria.length > 0,
    component: 'superpowers',
    required: false,
    reason: 'Goal has acceptance criteria — Superpowers provides verification-before-completion',
  },
  {
    check: (spec) => spec.ecosystem?.omc === true,
    component: 'omc',
    required: true,
    reason: 'Goal explicitly requires OMC (ralph/ultrawork/team execution modes)',
  },
  {
    check: (spec) => spec.ecosystem?.superpowers === true,
    component: 'superpowers',
    required: true,
    reason: 'Goal explicitly requires Superpowers (TDD, verification, code-review)',
  },
  {
    check: (spec) => spec.ecosystem?.openspec === true,
    component: 'openspec',
    required: true,
    reason: 'Goal explicitly requires OpenSpec (change lifecycle tracking)',
  },
  {
    check: (spec) => spec.ecosystem?.gstack === true,
    component: 'gstack',
    required: true,
    reason: 'Goal explicitly requires gstack (/ship, /review, /qa, /cso role-based review)',
  },
  {
    check: (spec) => spec.ecosystem?.ecc === true,
    component: 'ecc',
    required: true,
    reason: 'Goal explicitly requires ECC (language-specific rules, hooks, agents)',
  },
];

export interface EcosystemHarnessInput {
  goalSpec: GoalSpec;
  ecosystem: EcosystemDetection;
}

export interface EcosystemHarnessOutput {
  success: boolean;
  diagnostics: Diagnostic[];
  recommendations: { component: string; required: boolean; reason: string }[];
}

/**
 * Run the ecosystem harness.
 * Checks if the goal's skills and configuration are compatible with installed ecosystem components.
 */
export function runEcosystemHarness(input: EcosystemHarnessInput): EcosystemHarnessOutput {
  const diagnostics: Diagnostic[] = [];
  const recommendations: { component: string; required: boolean; reason: string }[] = [];

  // Check skill-to-ecosystem compatibility
  for (const skill of input.goalSpec.skills) {
    const mapping = SKILL_ECOSYSTEM_MAP[skill];
    if (!mapping) continue;

    const isInstalled = input.ecosystem[mapping.component];
    if (!isInstalled) {
      const diagnostic = mapping.required
        ? createWarning(
            'ECOSYSTEM_SKILL_REQUIRES_COMPONENT',
            `Skill "${skill}" requires ${mapping.component} but it is not installed`,
            { hint: mapping.reason },
          )
        : createInfo(
            'ECOSYSTEM_SKILL_RECOMMENDS_COMPONENT',
            `Skill "${skill}" works better with ${mapping.component} installed`,
            { hint: mapping.reason },
          );
      diagnostics.push(diagnostic);
      recommendations.push({
        component: mapping.component,
        required: mapping.required,
        reason: mapping.reason,
      });
    }
  }

  // Check goal-to-ecosystem compatibility
  for (const check of GOAL_ECOSYSTEM_CHECKS) {
    if (check.check(input.goalSpec)) {
      const isInstalled = input.ecosystem[check.component];
      if (!isInstalled) {
        const diagnostic = check.required
          ? createWarning(
              'ECOSYSTEM_GOAL_REQUIRES_COMPONENT',
              `Goal requires ${check.component} but it is not installed`,
              { hint: check.reason },
            )
          : createInfo(
              'ECOSYSTEM_GOAL_RECOMMENDS_COMPONENT',
              `Goal would benefit from ${check.component}`,
              { hint: check.reason },
            );
        diagnostics.push(diagnostic);
        recommendations.push({
          component: check.component,
          required: check.required,
          reason: check.reason,
        });
      }
    }
  }

  // Check if any critical components are missing
  const hasCriticalMissing = recommendations.some((r) => r.required);
  const hasWarnings = diagnostics.some((d) => d.severity === 'warning');

  return {
    success: !hasCriticalMissing && !hasWarnings,
    diagnostics,
    recommendations,
  };
}
