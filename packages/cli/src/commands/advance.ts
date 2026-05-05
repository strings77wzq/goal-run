import { resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { loadConfig } from '../utils/config.js';
import { autoAdvance, isTerminal, captureFullDiff, type RunState } from 'goalrun-core';

export async function advanceCommand(runId: string, opts: { json?: boolean }): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const runDir = resolve(repoRoot, config.runs_dir, runId);
  const statusPath = resolve(runDir, 'status.json');

  if (!existsSync(statusPath)) {
    console.error(pc.red(`Run "${runId}" not found.`));
    process.exit(1);
  }

  let state: RunState;
  try {
    state = JSON.parse(readFileSync(statusPath, 'utf-8')) as RunState;
  } catch {
    console.error(pc.red(`Failed to parse status.json for "${runId}"`));
    process.exit(1);
  }

  if (isTerminal(state.status)) {
    if (state.status === 'planned' && (!state.checkpoints || state.checkpoints.length === 0)) {
      console.log(pc.yellow(`Run "${runId}" was created without --loop.`));
      console.log(pc.dim('The advance/resume state machine requires --loop mode.'));
      console.log(pc.dim('Re-create the run: goalrun run <goal> --supervised --loop'));
      return;
    }
    console.log(pc.yellow(`Run "${runId}" is in terminal state: ${state.status}`));
    console.log(pc.dim("Nothing to advance. Use 'goalrun report' to view."));
    return;
  }

  // Determine diff root (worktree if isolated, else repo root)
  const diffRoot =
    state.isolated && state.worktree_path ? resolve(repoRoot, state.worktree_path) : repoRoot;

  // Semi-autonomous advance
  const result = autoAdvance(state);

  // Save all checkpoints with diff capture
  for (const cp of result.checkpoints) {
    const cpDir = resolve(runDir, 'checkpoints', cp.id);
    mkdirSync(cpDir, { recursive: true });
    writeFileSync(resolve(cpDir, 'status.json'), JSON.stringify(cp, null, 2), 'utf-8');

    // Capture diff at this checkpoint
    const diffResult = captureFullDiff(diffRoot);
    if (diffResult.success) {
      writeFileSync(resolve(cpDir, 'diff.patch'), diffResult.diff, 'utf-8');
    }
  }

  // Save updated state
  const updatedState = {
    ...result.state,
    checkpoints: [...state.checkpoints, ...result.checkpoints],
  };
  writeFileSync(statusPath, JSON.stringify(updatedState, null, 2), 'utf-8');

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          run_id: runId,
          status: result.state.status,
          checkpoints: result.checkpoints.map((c) => c.id),
          stopped_at_gate: result.stopped_at_gate,
        },
        null,
        2,
      ),
    );
  } else {
    // Show transitions
    for (const cp of result.checkpoints) {
      console.log(pc.dim(`  ${cp.id} → ${cp.status}${cp.summary ? ` — ${cp.summary}` : ''}`));
    }

    console.log('');
    const icon = isTerminal(result.state.status)
      ? result.state.status === 'completed'
        ? pc.green('✓')
        : pc.red('✗')
      : pc.cyan('◉');
    console.log(`${icon} Status: ${pc.bold(result.state.status)}`);

    if (result.stopped_at_gate) {
      console.log('');
      console.log(pc.yellow('Stopped at human gate.'));
      printHumanAction(result.state.status, runId);
    } else if (isTerminal(result.state.status)) {
      console.log('');
      if (result.state.status === 'completed') {
        console.log(pc.green('Run completed. All criteria passed.'));
        console.log(pc.dim(`Next: goalrun audit ${runId}`));
      } else if (result.state.status === 'failed') {
        console.log(pc.red('Run failed. Budget exhausted or unrecoverable error.'));
        console.log(pc.dim(`Next: goalrun report ${runId}`));
      }
    }
  }
}

function printHumanAction(status: string, runId: string): void {
  switch (status) {
    case 'waiting_for_user':
      console.log(pc.bold('Action required:'));
      console.log("  1. Review the agent's output in .goalrun/runs/" + runId + '/artifacts/');
      console.log('  2. Update criteria status if needed');
      console.log(pc.dim(`  3. Run: goalrun advance ${runId}`));
      break;
    case 'blocked_by_policy':
      console.log(pc.bold('Action required:'));
      console.log('  A policy gate was triggered. Review and approve/reject.');
      console.log(pc.dim(`  If approved: goalrun resume ${runId} --to waiting_for_user`));
      console.log(pc.dim(`  If rejected: goalrun stop ${runId}`));
      break;
  }
}
