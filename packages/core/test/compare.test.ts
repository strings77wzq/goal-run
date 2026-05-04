import { describe, it, expect } from 'vitest';
import { compareRuns, type RunDiff } from '../src/compare.js';
import { createRunState } from '../src/run-state.js';

describe('compareRuns', () => {
  it('compares two runs with same criteria', () => {
    const a = createRunState(
      'run-a',
      'goal-1',
      ['s1'],
      ['criterion 1', 'criterion 2'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    const b = createRunState(
      'run-b',
      'goal-1',
      ['s1'],
      ['criterion 1', 'criterion 2'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );

    const diff = compareRuns(a, b);
    expect(diff.runIdA).toBe('run-a');
    expect(diff.runIdB).toBe('run-b');
    expect(diff.criteriaDiff).toHaveLength(2);
    expect(diff.criteriaDiff.every((c) => !c.changed)).toBe(true);
  });

  it('detects criteria that changed', () => {
    const a = createRunState(
      'a',
      'g',
      ['s'],
      ['test'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    // Manually set a criterion to pass in b
    const b = {
      ...createRunState(
        'b',
        'g',
        ['s'],
        ['test'],
        { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
        [],
      ),
      criteria: [{ text: 'test', status: 'pass' as const }],
    };

    const diff = compareRuns(a, b);
    expect(diff.criteriaDiff[0]!.changed).toBe(true);
    expect(diff.criteriaDiff[0]!.statusA).toBe('pending');
    expect(diff.criteriaDiff[0]!.statusB).toBe('pass');
    expect(diff.summary).toContain('1 criteria improved');
  });

  it('computes iteration delta', () => {
    const a = {
      ...createRunState(
        'a',
        'g',
        ['s'],
        ['c'],
        { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
        [],
      ),
      iteration: 2,
    };
    const b = {
      ...createRunState(
        'b',
        'g',
        ['s'],
        ['c'],
        { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
        [],
      ),
      iteration: 4,
    };

    const diff = compareRuns(a, b);
    expect(diff.iterationDiff.a).toBe(2);
    expect(diff.iterationDiff.b).toBe(4);
    expect(diff.iterationDiff.delta).toBe(2);
  });

  it('computes checkpoint delta', () => {
    const a = createRunState(
      'a',
      'g',
      ['s'],
      ['c'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    const b = createRunState(
      'b',
      'g',
      ['s'],
      ['c'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    const bWithCP = {
      ...b,
      checkpoints: [
        {
          id: '001',
          iteration: 1,
          status: 'waiting_for_agent' as const,
          created_at: new Date().toISOString(),
        },
      ],
    };

    const diff = compareRuns(a, bWithCP);
    expect(diff.checkpointDiff.a).toBe(0);
    expect(diff.checkpointDiff.b).toBe(1);
    expect(diff.checkpointDiff.delta).toBe(1);
  });

  it('reports regression when criteria go from pass to fail', () => {
    const a = {
      ...createRunState(
        'a',
        'g',
        ['s'],
        ['test'],
        { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
        [],
      ),
      criteria: [{ text: 'test', status: 'pass' as const }],
    };
    const b = {
      ...createRunState(
        'b',
        'g',
        ['s'],
        ['test'],
        { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
        [],
      ),
      criteria: [{ text: 'test', status: 'fail' as const }],
    };

    const diff = compareRuns(a, b);
    expect(diff.summary).toContain('1 criteria regressed');
  });
});
