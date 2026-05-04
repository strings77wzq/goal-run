import { z } from 'zod';

export const RUN_STATUSES = [
  'planned',
  'waiting_for_agent',
  'waiting_for_user',
  'verifying',
  'needs_revision',
  'blocked_by_policy',
  'completed',
  'failed',
  'stopped',
] as const;

export const RunStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const CriterionStatusSchema = z.object({
  text: z.string(),
  status: z.enum(['pending', 'pass', 'fail']),
});

export const CheckpointSchema = z.object({
  id: z.string(),
  iteration: z.number().int().min(0),
  status: RunStatusSchema,
  created_at: z.string(),
  summary: z.string().optional(),
});

export const BudgetSchema = z.object({
  max_iterations: z.number().int().positive(),
  max_changed_files: z.number().int().positive(),
  max_runtime_minutes: z.number().int().positive(),
});

export const RunStateSchema = z.object({
  run_id: z.string().min(1),
  goal_id: z.string().min(1),
  status: RunStatusSchema,
  iteration: z.number().int().min(0),
  max_iterations: z.number().int().min(1),
  skills: z.array(z.string()),
  criteria: z.array(CriterionStatusSchema),
  started_at: z.string(),
  completed_at: z.string().optional(),
  checkpoints: z.array(CheckpointSchema),
  budget: BudgetSchema,
  policy_gates: z.array(z.string()),
  current_skill: z.string().optional(),
  error: z.string().optional(),
  isolated: z.boolean().optional(),
  worktree_path: z.string().optional(),
});

export type RunState = z.infer<typeof RunStateSchema>;
export type CriterionStatus = z.infer<typeof CriterionStatusSchema>;
export type Checkpoint = z.infer<typeof CheckpointSchema>;

export const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  planned: ['waiting_for_agent', 'stopped', 'failed'],
  waiting_for_agent: ['waiting_for_user', 'stopped', 'failed'],
  waiting_for_user: ['verifying', 'waiting_for_agent', 'stopped', 'failed'],
  verifying: ['completed', 'needs_revision', 'blocked_by_policy', 'stopped', 'failed'],
  needs_revision: ['waiting_for_agent', 'stopped', 'failed'],
  blocked_by_policy: ['waiting_for_user', 'stopped', 'failed'],
  completed: [],
  failed: [],
  stopped: [],
};

export function isTerminal(status: RunStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

export function canAdvanceTo(current: RunStatus, next: RunStatus): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export function createRunState(
  runId: string,
  goalId: string,
  skills: string[],
  criteria: string[],
  budget: { max_iterations: number; max_changed_files: number; max_runtime_minutes: number },
  policyGates: string[],
): RunState {
  return {
    run_id: runId,
    goal_id: goalId,
    status: 'planned',
    iteration: 0,
    max_iterations: budget.max_iterations,
    skills,
    criteria: criteria.map((c) => ({ text: c, status: 'pending' as const })),
    started_at: new Date().toISOString(),
    checkpoints: [],
    budget,
    policy_gates: policyGates,
  };
}

export function advanceState(
  state: RunState,
  nextStatus: RunStatus,
): { success: true; state: RunState } | { success: false; error: string } {
  if (!canAdvanceTo(state.status, nextStatus)) {
    return {
      success: false,
      error: `Cannot transition from "${state.status}" to "${nextStatus}"`,
    };
  }

  const nextIteration = nextStatus === 'waiting_for_agent' ? state.iteration + 1 : state.iteration;

  const updates: Partial<RunState> = {
    status: nextStatus,
    iteration: nextIteration,
  };

  if (isTerminal(nextStatus)) {
    updates.completed_at = new Date().toISOString();
  }

  return {
    success: true,
    state: { ...state, ...updates },
  };
}

export function createCheckpoint(
  state: RunState,
  summary?: string,
): { state: RunState; checkpoint: Checkpoint } {
  const checkpoint: Checkpoint = {
    id: `${String(state.iteration).padStart(3, '0')}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    iteration: state.iteration,
    status: state.status,
    created_at: new Date().toISOString(),
    summary,
  };

  return {
    state: {
      ...state,
      checkpoints: [...state.checkpoints, checkpoint],
    },
    checkpoint,
  };
}

export function updateCriteriaStatus(
  state: RunState,
  index: number,
  newStatus: 'pending' | 'pass' | 'fail',
): RunState {
  const criteria = state.criteria.map((c, i) => (i === index ? { ...c, status: newStatus } : c));
  return { ...state, criteria };
}

export function allCriteriaPassed(state: RunState): boolean {
  return state.criteria.length > 0 && state.criteria.every((c) => c.status === 'pass');
}

export function isBudgetExhausted(state: RunState): boolean {
  return state.iteration >= state.max_iterations;
}

// ── P2-R Semi-Autonomous Loop ──

const HUMAN_GATES: RunStatus[] = ['waiting_for_user', 'blocked_by_policy'];

export function needsHumanInput(status: RunStatus): boolean {
  return HUMAN_GATES.includes(status);
}

export const AUTO_TRANSITIONS: Record<RunStatus, RunStatus | null> = {
  planned: 'waiting_for_agent',
  waiting_for_agent: 'waiting_for_user',
  waiting_for_user: null,
  verifying: null,
  needs_revision: 'waiting_for_agent',
  blocked_by_policy: null,
  completed: null,
  failed: null,
  stopped: null,
};

export interface AutoAdvanceResult {
  state: RunState;
  checkpoints: Checkpoint[];
  stopped_at_gate: boolean;
}

export function autoAdvance(state: RunState): AutoAdvanceResult {
  const checkpoints: Checkpoint[] = [];
  let current = { ...state };

  // Terminal states — no advancing
  if (isTerminal(current.status)) {
    return { state: current, checkpoints: [], stopped_at_gate: false };
  }

  // Budget check: if exhausted, fail immediately
  if (isBudgetExhausted(current)) {
    const failed = {
      ...current,
      status: 'failed' as const,
      completed_at: new Date().toISOString(),
    };
    const cp = createCheckpointInternal(failed, 'Budget exhausted — auto-failed');
    return { state: failed, checkpoints: [cp], stopped_at_gate: false };
  }

  // Auto-advance through safe states until hitting a human gate or terminal
  for (let safety = 0; safety < 20; safety++) {
    if (isTerminal(current.status)) break;
    if (needsHumanInput(current.status)) {
      return { state: current, checkpoints, stopped_at_gate: true };
    }

    // Special handling for 'verifying': check criteria
    if (current.status === 'verifying') {
      if (allCriteriaPassed(current)) {
        const result = advanceState(current, 'completed');
        if (!result.success) break;
        current = result.success ? result.state : current;
        const cp = createCheckpointInternal(current, 'All criteria passed — auto-completed');
        checkpoints.push(cp);
        break;
      } else {
        const result = advanceState(current, 'needs_revision');
        if (!result.success) break;
        current = result.success ? result.state : current;
        const cp = createCheckpointInternal(current, 'Criteria not met — auto-revision');
        checkpoints.push(cp);
        // Continue loop: needs_revision → waiting_for_agent → waiting_for_user (gate)
        continue;
      }
    }

    // Standard auto-transition
    const next = AUTO_TRANSITIONS[current.status];
    if (!next) break;

    const result = advanceState(current, next);
    if (!result.success) break;
    current = result.success ? result.state : current;
    const cp = createCheckpointInternal(current, `Auto-advanced to ${next}`);
    checkpoints.push(cp);
  }

  return { state: current, checkpoints, stopped_at_gate: needsHumanInput(current.status) };
}

function createCheckpointInternal(state: RunState, summary: string): Checkpoint {
  return {
    id: `${String(state.iteration).padStart(3, '0')}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    iteration: state.iteration,
    status: state.status,
    created_at: new Date().toISOString(),
    summary,
  };
}
