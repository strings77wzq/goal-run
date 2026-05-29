import { describe, it, expect } from 'vitest';
import { runEcosystemHarness } from '../src/ecosystem-harness.js';
import type { GoalSpec, EcosystemDetection } from 'goalrun-core';

function makeGoalSpec(overrides: Partial<GoalSpec> = {}): GoalSpec {
  return {
    id: 'test-goal',
    title: 'Test Goal',
    goal: 'Test something',
    skills: ['tdd-change'],
    criteria: ['all tests pass'],
    budget: { max_iterations: 5, max_changed_files: 10, max_runtime_minutes: 60 },
    policy: { require_approval_for: [] },
    verification: { commands: ['pnpm test'] },
    ...overrides,
  };
}

function makeEcosystem(overrides: Partial<EcosystemDetection> = {}): EcosystemDetection {
  return {
    superpowers: false,
    omc: false,
    openspec: false,
    gstack: false,
    ecc: false,
    diagnostics: [],
    ...overrides,
  };
}

describe('runEcosystemHarness', () => {
  it('passes when all required components are installed', () => {
    const result = runEcosystemHarness({
      goalSpec: makeGoalSpec(),
      ecosystem: makeEcosystem({ superpowers: true }),
    });
    // tdd-change recommends superpowers, which is installed
    expect(result.diagnostics.filter((d) => d.severity === 'warning')).toEqual([]);
  });

  it('warns when recommended component is missing', () => {
    const result = runEcosystemHarness({
      goalSpec: makeGoalSpec({ skills: ['tdd-change'] }),
      ecosystem: makeEcosystem({ superpowers: false }),
    });
    expect(result.diagnostics.some((d) => d.code === 'ECOSYSTEM_SKILL_RECOMMENDS_COMPONENT')).toBe(
      true,
    );
    expect(result.recommendations.some((r) => r.component === 'superpowers')).toBe(true);
  });

  it('warns when goal explicitly requires missing component', () => {
    const result = runEcosystemHarness({
      goalSpec: makeGoalSpec({ ecosystem: { omc: true } }),
      ecosystem: makeEcosystem({ omc: false }),
    });
    expect(result.diagnostics.some((d) => d.code === 'ECOSYSTEM_GOAL_REQUIRES_COMPONENT')).toBe(
      true,
    );
  });

  it('passes when goal requires installed component', () => {
    const result = runEcosystemHarness({
      goalSpec: makeGoalSpec({ ecosystem: { omc: true } }),
      ecosystem: makeEcosystem({ omc: true }),
    });
    expect(result.diagnostics.filter((d) => d.severity === 'warning')).toEqual([]);
  });

  it('recommends openspec for pipeline goals', () => {
    const result = runEcosystemHarness({
      goalSpec: makeGoalSpec({ pipeline_stage: 'dev' }),
      ecosystem: makeEcosystem({ openspec: false }),
    });
    expect(result.recommendations.some((r) => r.component === 'openspec')).toBe(true);
  });

  it('recommends superpowers for goals with acceptance criteria', () => {
    const result = runEcosystemHarness({
      goalSpec: makeGoalSpec({
        acceptance_criteria: [{ given: 'x', when: 'y', then: 'z' }],
      }),
      ecosystem: makeEcosystem({ superpowers: false }),
    });
    expect(result.recommendations.some((r) => r.component === 'superpowers')).toBe(true);
  });

  it('handles multiple missing components', () => {
    const result = runEcosystemHarness({
      goalSpec: makeGoalSpec({
        skills: ['tdd-change', 'code-review'],
        ecosystem: { omc: true, openspec: true },
      }),
      ecosystem: makeEcosystem({ superpowers: false, omc: false, openspec: false }),
    });
    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
  });

  it('returns success true when no warnings or errors', () => {
    const result = runEcosystemHarness({
      goalSpec: makeGoalSpec(),
      ecosystem: makeEcosystem({
        superpowers: true,
        omc: true,
        openspec: true,
        gstack: true,
        ecc: true,
      }),
    });
    expect(result.success).toBe(true);
  });
});
