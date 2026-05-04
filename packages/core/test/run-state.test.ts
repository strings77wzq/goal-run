import { describe, it, expect } from 'vitest';
import {
  RunStateSchema,
  RunStatusSchema,
  createRunState,
  advanceState,
  canAdvanceTo,
  isTerminal,
  needsHumanInput,
  autoAdvance,
  AUTO_TRANSITIONS,
  VALID_TRANSITIONS,
  type RunState,
  type RunStatus,
} from '../src/run-state.js';

describe('RunStatusSchema', () => {
  it('accepts all valid status values', () => {
    const valid = [
      'planned',
      'waiting_for_agent',
      'waiting_for_user',
      'verifying',
      'needs_revision',
      'blocked_by_policy',
      'completed',
      'failed',
      'stopped',
    ];
    for (const s of valid) {
      expect(RunStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(RunStatusSchema.safeParse('running').success).toBe(false);
    expect(RunStatusSchema.safeParse('paused').success).toBe(false);
  });
});

describe('RunStateSchema', () => {
  it('validates a complete run state', () => {
    const state = {
      run_id: '2026-05-04T12-00-00-000Z',
      goal_id: 'example-fix-bug',
      status: 'planned',
      iteration: 0,
      max_iterations: 5,
      skills: ['tdd-change'],
      criteria: [{ text: 'tests pass', status: 'pending' }],
      started_at: new Date().toISOString(),
      checkpoints: [],
      budget: { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      policy_gates: [],
    };
    expect(RunStateSchema.safeParse(state).success).toBe(true);
  });

  it('rejects negative iteration', () => {
    const state = {
      run_id: 'r1',
      goal_id: 'g1',
      status: 'planned',
      iteration: -1,
      max_iterations: 5,
      skills: [],
      criteria: [],
      started_at: new Date().toISOString(),
      checkpoints: [],
      budget: { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      policy_gates: [],
    };
    expect(RunStateSchema.safeParse(state).success).toBe(false);
  });
});

describe('createRunState', () => {
  it('creates initial planned state', () => {
    const state = createRunState(
      'run-001',
      'fix-bug',
      ['tdd-change', 'code-review'],
      ['tests pass', 'no regression'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      ['changes_public_api'],
    );
    expect(state.status).toBe('planned');
    expect(state.iteration).toBe(0);
    expect(state.run_id).toBe('run-001');
    expect(state.criteria).toEqual([
      { text: 'tests pass', status: 'pending' },
      { text: 'no regression', status: 'pending' },
    ]);
  });
});

describe('VALID_TRANSITIONS', () => {
  it('planned can go to waiting_for_agent', () => {
    expect(VALID_TRANSITIONS.planned).toContain('waiting_for_agent');
  });

  it('waiting_for_agent can go to waiting_for_user', () => {
    expect(VALID_TRANSITIONS.waiting_for_agent).toContain('waiting_for_user');
  });

  it('verifying can go to completed or needs_revision', () => {
    expect(VALID_TRANSITIONS.verifying).toContain('completed');
    expect(VALID_TRANSITIONS.verifying).toContain('needs_revision');
  });

  it('terminal states have no transitions', () => {
    expect(VALID_TRANSITIONS.completed).toHaveLength(0);
    expect(VALID_TRANSITIONS.failed).toHaveLength(0);
    expect(VALID_TRANSITIONS.stopped).toHaveLength(0);
  });
});

describe('canAdvanceTo', () => {
  it('allows valid transition', () => {
    expect(canAdvanceTo('planned', 'waiting_for_agent')).toBe(true);
  });

  it('rejects invalid transition', () => {
    expect(canAdvanceTo('planned', 'completed')).toBe(false);
  });

  it('rejects transition from terminal state', () => {
    expect(canAdvanceTo('completed', 'planned')).toBe(false);
  });
});

describe('advanceState', () => {
  it('advances to next valid status', () => {
    const state = createRunState(
      'r1',
      'g1',
      ['s1'],
      ['c1'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    const result = advanceState(state, 'waiting_for_agent');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.state.status).toBe('waiting_for_agent');
    }
  });

  it('rejects invalid transition', () => {
    const state = createRunState(
      'r1',
      'g1',
      ['s1'],
      ['c1'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    const result = advanceState(state, 'completed');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Cannot transition');
    }
  });

  it('increments iteration when advancing to waiting_for_agent', () => {
    const state = createRunState(
      'r1',
      'g1',
      ['s1'],
      ['c1'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    const result = advanceState(state, 'waiting_for_agent');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.state.iteration).toBe(1);
    }
  });
});

describe('isTerminal', () => {
  it('completed is terminal', () => expect(isTerminal('completed')).toBe(true));
  it('failed is terminal', () => expect(isTerminal('failed')).toBe(true));
  it('stopped is terminal', () => expect(isTerminal('stopped')).toBe(true));
  it('planned is not terminal', () => expect(isTerminal('planned')).toBe(false));
  it('waiting_for_agent is not terminal', () =>
    expect(isTerminal('waiting_for_agent')).toBe(false));
});

describe('needsHumanInput', () => {
  it('waiting_for_user requires human', () =>
    expect(needsHumanInput('waiting_for_user')).toBe(true));
  it('blocked_by_policy requires human', () =>
    expect(needsHumanInput('blocked_by_policy')).toBe(true));
  it('planned does not require human', () => expect(needsHumanInput('planned')).toBe(false));
  it('verifying does not require human', () => expect(needsHumanInput('verifying')).toBe(false));
  it('needs_revision does not require human', () =>
    expect(needsHumanInput('needs_revision')).toBe(false));
  it('waiting_for_agent does not require human', () =>
    expect(needsHumanInput('waiting_for_agent')).toBe(false));
  it('terminal states do not require human', () => {
    expect(needsHumanInput('completed')).toBe(false);
    expect(needsHumanInput('failed')).toBe(false);
    expect(needsHumanInput('stopped')).toBe(false);
  });
});

describe('AUTO_TRANSITIONS', () => {
  it('planned auto-advances to waiting_for_agent', () => {
    expect(AUTO_TRANSITIONS.planned).toBe('waiting_for_agent');
  });
  it('waiting_for_agent auto-advances to waiting_for_user', () => {
    expect(AUTO_TRANSITIONS.waiting_for_agent).toBe('waiting_for_user');
  });
  it('waiting_for_user has no auto-transition (needs human)', () => {
    expect(AUTO_TRANSITIONS.waiting_for_user).toBeNull();
  });
  it('verifying has no fixed auto-transition (depends on criteria)', () => {
    expect(AUTO_TRANSITIONS.verifying).toBeNull();
  });
  it('needs_revision auto-advances to waiting_for_agent', () => {
    expect(AUTO_TRANSITIONS.needs_revision).toBe('waiting_for_agent');
  });
  it('blocked_by_policy has no auto-transition (needs human)', () => {
    expect(AUTO_TRANSITIONS.blocked_by_policy).toBeNull();
  });
});

describe('autoAdvance', () => {
  it('auto-advances from planned to waiting_for_user (skips safe states)', () => {
    const state = createRunState(
      'r1',
      'g1',
      ['s1'],
      ['c1'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    const result = autoAdvance(state);
    expect(result.state.status).toBe('waiting_for_user');
    expect(result.checkpoints.length).toBeGreaterThanOrEqual(1);
  });

  it('stops at human gate (waiting_for_user)', () => {
    const state = createRunState(
      'r1',
      'g1',
      ['s1'],
      ['c1'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    // Set to waiting_for_user
    state.status = 'waiting_for_user';
    const result = autoAdvance(state);
    expect(result.state.status).toBe('waiting_for_user');
    expect(result.stopped_at_gate).toBe(true);
  });

  it('auto-completes from verifying when all criteria pass', () => {
    const state = createRunState(
      'r1',
      'g1',
      ['s1'],
      ['test'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    state.status = 'verifying';
    state.criteria = [{ text: 'test', status: 'pass' }];
    const result = autoAdvance(state);
    expect(result.state.status).toBe('completed');
  });

  it('auto-advances from verifying to waiting_for_user when criteria fail (via needs_revision)', () => {
    const state = createRunState(
      'r1',
      'g1',
      ['s1'],
      ['test'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    state.status = 'verifying';
    state.criteria = [{ text: 'test', status: 'fail' }];
    const result = autoAdvance(state);
    // verifying → needs_revision → waiting_for_agent → waiting_for_user (gate)
    expect(result.state.status).toBe('waiting_for_user');
    expect(result.checkpoints.length).toBeGreaterThanOrEqual(2);
  });

  it('fails when budget exhausted', () => {
    const state = createRunState(
      'r1',
      'g1',
      ['s1'],
      ['c1'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    state.iteration = 5;
    state.max_iterations = 5;
    const result = autoAdvance(state);
    expect(result.state.status).toBe('failed');
  });

  it('does nothing for terminal states', () => {
    const state = createRunState(
      'r1',
      'g1',
      ['s1'],
      ['c1'],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      [],
    );
    state.status = 'completed';
    const result = autoAdvance(state);
    expect(result.state.status).toBe('completed');
    expect(result.checkpoints).toHaveLength(0);
  });
});
