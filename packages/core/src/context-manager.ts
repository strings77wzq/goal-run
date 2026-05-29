import type { PipelineStage } from './goal-schema.js';
import type { RunState } from './run-state.js';

/**
 * Token budget estimates per pipeline stage (in thousands of tokens).
 * These are rough estimates for planning purposes.
 */
const STAGE_TOKEN_BUDGETS: Record<PipelineStage, { min: number; max: number }> = {
  change: { min: 5, max: 15 },
  requirement: { min: 10, max: 30 },
  design: { min: 15, max: 40 },
  task: { min: 10, max: 25 },
  dev: { min: 30, max: 100 },
  test: { min: 20, max: 60 },
  review: { min: 15, max: 40 },
  integration: { min: 10, max: 30 },
};

/**
 * Estimate token budget for a pipeline stage.
 */
export function estimateTokenBudget(stage: PipelineStage): {
  stage: PipelineStage;
  minK: number;
  maxK: number;
  recommendation: string;
} {
  const budget = STAGE_TOKEN_BUDGETS[stage];
  let recommendation: string;

  if (budget.max <= 30) {
    recommendation = 'Single-pass execution should be fine.';
  } else if (budget.max <= 60) {
    recommendation = 'Consider splitting into sub-tasks if context fills up.';
  } else {
    recommendation = 'High token stage. Use incremental approach with checkpoints.';
  }

  return { stage, minK: budget.min, maxK: budget.max, recommendation };
}

/**
 * Window reset triggers — conditions that suggest context should be cleared.
 */
export interface WindowResetTrigger {
  type: 'token_estimate' | 'repetition_detected' | 'error_loop' | 'manual';
  message: string;
  severity: 'info' | 'warning';
}

/**
 * Check for conditions that suggest a context window reset is needed.
 */
export function checkWindowResetTriggers(
  state: RunState,
  options?: {
    estimatedTokensUsed?: number;
    repeatedOutputs?: number;
    consecutiveErrors?: number;
  },
): WindowResetTrigger[] {
  const triggers: WindowResetTrigger[] = [];

  // Token estimate trigger (50k threshold)
  if (options?.estimatedTokensUsed && options.estimatedTokensUsed > 50_000) {
    triggers.push({
      type: 'token_estimate',
      message: `Estimated token usage (${options.estimatedTokensUsed}) exceeds 50k threshold. Consider clearing context.`,
      severity: 'warning',
    });
  }

  // Repetition trigger
  if (options?.repeatedOutputs && options.repeatedOutputs >= 3) {
    triggers.push({
      type: 'repetition_detected',
      message: `Detected ${options.repeatedOutputs} repeated outputs. Agent may be looping.`,
      severity: 'warning',
    });
  }

  // Error loop trigger
  if (options?.consecutiveErrors && options.consecutiveErrors >= 3) {
    triggers.push({
      type: 'error_loop',
      message: `${options.consecutiveErrors} consecutive errors detected. Consider clearing context and reviewing PROGRESS.md.`,
      severity: 'warning',
    });
  }

  // High iteration count
  if (state.iteration > state.max_iterations * 0.8) {
    triggers.push({
      type: 'token_estimate',
      message: `Iteration count (${state.iteration}/${state.max_iterations}) approaching budget limit.`,
      severity: 'info',
    });
  }

  return triggers;
}

/**
 * Generate a PROGRESS.md file content from the current run state.
 * This file preserves context across window resets.
 */
export function generateProgressFile(state: RunState): string {
  const lines: string[] = [
    '# PROGRESS.md — Run Progress (Auto-Generated)',
    '',
    '> This file preserves context across window resets. Reload it after clearing context.',
    '',
    `## Run: ${state.run_id}`,
    `## Goal: ${state.goal_id}`,
    `## Status: ${state.status}`,
    `## Iteration: ${state.iteration}/${state.max_iterations}`,
    '',
    '## Pipeline Progress',
    '',
  ];

  if (state.pipeline_progress) {
    for (const [stage, status] of Object.entries(state.pipeline_progress)) {
      const icon = status === 'completed' ? '✅' : status === 'in_progress' ? '🔄' : '⏳';
      lines.push(`- ${icon} ${stage}: ${status}`);
    }
  } else {
    lines.push('- No pipeline progress tracked');
  }

  lines.push('', '## Criteria Status', '');

  for (const criterion of state.criteria) {
    const icon = criterion.status === 'pass' ? '✅' : criterion.status === 'fail' ? '❌' : '⏳';
    lines.push(`- ${icon} ${criterion.text}`);
  }

  if (state.checkpoints.length > 0) {
    lines.push('', '## Recent Checkpoints', '');
    const recent = state.checkpoints.slice(-5);
    for (const cp of recent) {
      lines.push(`- [${cp.id}] ${cp.status} — ${cp.summary ?? 'no summary'}`);
    }
  }

  if (state.error) {
    lines.push('', '## Error', '', state.error);
  }

  lines.push(
    '',
    '## Excluded Approaches',
    '',
    '> After a window reset, check this list before retrying. Add failed approaches here.',
    '',
    '- (none yet)',
    '',
    '## Next Steps',
    '',
    '> What to do after reloading context:',
    '',
    getNextSteps(state),
  );

  return lines.join('\n');
}

function getNextSteps(state: RunState): string {
  switch (state.status) {
    case 'waiting_for_agent':
      return '1. Agent should continue from current pipeline stage\n2. Check criteria status above\n3. Review excluded approaches before retrying';
    case 'waiting_for_user':
      return '1. Review agent output in artifacts/\n2. Update criteria status if needed\n3. Run: goalrun advance ' + state.run_id;
    case 'verifying':
      return '1. Run verification commands\n2. Check criteria pass/fail\n3. Advance when all criteria pass';
    case 'needs_revision':
      return '1. Review what failed\n2. Check excluded approaches\n3. Run: goalrun advance ' + state.run_id;
    case 'blocked_by_policy':
      return '1. Review policy gate violation\n2. Approve or reject\n3. Run: goalrun resume ' + state.run_id + ' --to waiting_for_user';
    default:
      return '1. Check current status with: goalrun status ' + state.run_id;
  }
}

/**
 * Restart protocol instructions for the handoff prompt.
 * Tells the agent how to recover after a context window reset.
 */
export function getRestartProtocol(): string {
  return [
    '## Context Window Reset Protocol',
    '',
    'If your context window fills up or you detect looping:',
    '',
    '1. **Before clearing**: The PROGRESS.md file has been auto-generated with current state.',
    '2. **After clearing**: Reload files in this order:',
    '   a. `.goalrun/CONTEXT.md` (project context)',
    '   b. `.goalrun/ARCHITECTURE.md` (architecture constraints)',
    '   c. `.goalrun/lessons.json` (failure patterns to avoid)',
    '   d. `PROGRESS.md` (current run state + excluded approaches)',
    '   e. Current task SKILL.md',
    '3. **Before retrying**: Check "Excluded Approaches" in PROGRESS.md.',
    '4. **Do not blind-retry**: If the same error occurs 3 times, stop and escalate.',
  ].join('\n');
}
