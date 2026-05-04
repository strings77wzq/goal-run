import { describe, it, expect } from 'vitest';
import { GoalSpecSchema, parseGoalSpec, type GoalSpec } from '../src/goal-schema.js';

const VALID_GOAL = `
id: example-fix-bug
title: Fix example bug with TDD
goal: >
  Fix the documented bug and add regression tests.
skills:
  - implementation-strategy
  - tdd-change
  - code-review
criteria:
  - regression test added
  - targeted tests pass
  - no public API change
budget:
  max_iterations: 5
  max_changed_files: 20
  max_runtime_minutes: 60
policy:
  require_approval_for:
    - changes_public_api
    - deletes_files
verification:
  commands:
    - pnpm test
    - pnpm typecheck
`;

describe('GoalSpecSchema', () => {
  it('validates a complete goal spec', () => {
    const spec = {
      id: 'fix-bug',
      title: 'Fix a bug',
      goal: 'Fix the reported bug with regression tests',
      skills: ['tdd-change', 'code-review'],
      criteria: ['tests pass', 'no regression'],
      budget: { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      policy: { require_approval_for: ['changes_public_api'] },
      verification: { commands: ['pnpm test'] },
    };
    const result = GoalSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const result = GoalSpecSchema.safeParse({
      title: 'x',
      goal: 'x',
      skills: ['x'],
      criteria: ['x'],
      budget: { max_iterations: 1, max_changed_files: 1, max_runtime_minutes: 1 },
      policy: { require_approval_for: [] },
      verification: { commands: ['x'] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty skills array', () => {
    const result = GoalSpecSchema.safeParse({
      id: 'x',
      title: 'x',
      goal: 'x',
      skills: [],
      criteria: ['x'],
      budget: { max_iterations: 1, max_changed_files: 1, max_runtime_minutes: 1 },
      policy: { require_approval_for: [] },
      verification: { commands: ['x'] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty criteria', () => {
    const result = GoalSpecSchema.safeParse({
      id: 'x',
      title: 'x',
      goal: 'x',
      skills: ['x'],
      criteria: [],
      budget: { max_iterations: 1, max_changed_files: 1, max_runtime_minutes: 1 },
      policy: { require_approval_for: [] },
      verification: { commands: ['x'] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty verification commands', () => {
    const result = GoalSpecSchema.safeParse({
      id: 'x',
      title: 'x',
      goal: 'x',
      skills: ['x'],
      criteria: ['x'],
      budget: { max_iterations: 1, max_changed_files: 1, max_runtime_minutes: 1 },
      policy: { require_approval_for: [] },
      verification: { commands: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative budget values', () => {
    expect(
      GoalSpecSchema.safeParse({
        id: 'x',
        title: 'x',
        goal: 'x',
        skills: ['x'],
        criteria: ['x'],
        budget: { max_iterations: -1, max_changed_files: 1, max_runtime_minutes: 1 },
        policy: { require_approval_for: [] },
        verification: { commands: ['x'] },
      }).success,
    ).toBe(false);
  });

  it('rejects zero max_iterations', () => {
    expect(
      GoalSpecSchema.safeParse({
        id: 'x',
        title: 'x',
        goal: 'x',
        skills: ['x'],
        criteria: ['x'],
        budget: { max_iterations: 0, max_changed_files: 1, max_runtime_minutes: 1 },
        policy: { require_approval_for: [] },
        verification: { commands: ['x'] },
      }).success,
    ).toBe(false);
  });

  it('accepts empty approval_for list', () => {
    const result = GoalSpecSchema.safeParse({
      id: 'x',
      title: 'x',
      goal: 'x',
      skills: ['x'],
      criteria: ['x'],
      budget: { max_iterations: 1, max_changed_files: 1, max_runtime_minutes: 1 },
      policy: { require_approval_for: [] },
      verification: { commands: ['x'] },
    });
    expect(result.success).toBe(true);
  });
});

describe('parseGoalSpec', () => {
  it('parses valid goal YAML', () => {
    const result = parseGoalSpec(VALID_GOAL, 'goal.yaml');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.spec.id).toBe('example-fix-bug');
      expect(result.spec.skills).toContain('tdd-change');
      expect(result.spec.budget.max_iterations).toBe(5);
      expect(result.spec.verification.commands).toContain('pnpm test');
    }
  });

  it('returns diagnostics for invalid YAML syntax', () => {
    const result = parseGoalSpec('{ invalid: yaml: : }', 'bad.yaml');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
    }
  });

  it('returns diagnostics for empty YAML', () => {
    const result = parseGoalSpec('', 'empty.yaml');
    expect(result.success).toBe(false);
  });

  it('returns diagnostics for missing required fields', () => {
    const result = parseGoalSpec('id: only-id\n', 'partial.yaml');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
    }
  });
});
