import { describe, it, expect } from 'vitest';
import {
  estimateTokenBudget,
  checkWindowResetTriggers,
  generateProgressFile,
  getRestartProtocol,
} from '../src/context-manager.js';
import type { RunState } from '../src/run-state.js';

function makeRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    run_id: 'test-run',
    goal_id: 'test-goal',
    status: 'waiting_for_agent',
    iteration: 3,
    max_iterations: 10,
    skills: ['tdd-change'],
    criteria: [
      { text: 'all tests pass', status: 'pending' },
      { text: 'no API change', status: 'pass' },
    ],
    started_at: '2026-01-01T00:00:00Z',
    checkpoints: [],
    budget: { max_iterations: 10, max_changed_files: 10, max_runtime_minutes: 60 },
    policy_gates: [],
    pipeline_stage: 'dev',
    pipeline_progress: {
      change: 'completed',
      requirement: 'completed',
      design: 'completed',
      task: 'completed',
      dev: 'in_progress',
      test: 'pending',
      review: 'pending',
      integration: 'pending',
    },
    ...overrides,
  };
}

describe('estimateTokenBudget', () => {
  it('returns budget for dev stage', () => {
    const result = estimateTokenBudget('dev');
    expect(result.stage).toBe('dev');
    expect(result.minK).toBeGreaterThan(0);
    expect(result.maxK).toBeGreaterThan(result.minK);
  });

  it('returns budget for review stage', () => {
    const result = estimateTokenBudget('review');
    expect(result.stage).toBe('review');
    expect(result.recommendation).toBeTruthy();
  });

  it('recommends splitting for high-token stages', () => {
    const result = estimateTokenBudget('dev');
    expect(result.maxK).toBeGreaterThanOrEqual(60);
  });
});

describe('checkWindowResetTriggers', () => {
  it('returns no triggers for normal state', () => {
    const state = makeRunState();
    const triggers = checkWindowResetTriggers(state);
    expect(triggers).toEqual([]);
  });

  it('triggers on high token usage', () => {
    const state = makeRunState();
    const triggers = checkWindowResetTriggers(state, { estimatedTokensUsed: 60_000 });
    expect(triggers.some((t) => t.type === 'token_estimate')).toBe(true);
  });

  it('triggers on repeated outputs', () => {
    const state = makeRunState();
    const triggers = checkWindowResetTriggers(state, { repeatedOutputs: 4 });
    expect(triggers.some((t) => t.type === 'repetition_detected')).toBe(true);
  });

  it('triggers on consecutive errors', () => {
    const state = makeRunState();
    const triggers = checkWindowResetTriggers(state, { consecutiveErrors: 5 });
    expect(triggers.some((t) => t.type === 'error_loop')).toBe(true);
  });

  it('triggers on high iteration count', () => {
    const state = makeRunState({ iteration: 9, max_iterations: 10 });
    const triggers = checkWindowResetTriggers(state);
    expect(triggers.some((t) => t.message.includes('approaching budget limit'))).toBe(true);
  });
});

describe('generateProgressFile', () => {
  it('generates progress file with run info', () => {
    const state = makeRunState();
    const content = generateProgressFile(state);
    expect(content).toContain('test-run');
    expect(content).toContain('test-goal');
    expect(content).toContain('waiting_for_agent');
  });

  it('includes pipeline progress', () => {
    const state = makeRunState();
    const content = generateProgressFile(state);
    expect(content).toContain('Pipeline Progress');
    expect(content).toContain('dev: in_progress');
  });

  it('includes criteria status', () => {
    const state = makeRunState();
    const content = generateProgressFile(state);
    expect(content).toContain('all tests pass');
    expect(content).toContain('no API change');
  });

  it('includes next steps', () => {
    const state = makeRunState();
    const content = generateProgressFile(state);
    expect(content).toContain('Next Steps');
  });
});

describe('getRestartProtocol', () => {
  it('returns protocol instructions', () => {
    const protocol = getRestartProtocol();
    expect(protocol).toContain('Context Window Reset Protocol');
    expect(protocol).toContain('PROGRESS.md');
    expect(protocol).toContain('CONTEXT.md');
    expect(protocol).toContain('lessons.json');
  });
});
