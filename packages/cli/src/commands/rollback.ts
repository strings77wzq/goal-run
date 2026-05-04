import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { loadConfig } from '../utils/config.js';
import { type RunState, isTerminal, removeWorktree } from 'goalrun-core';
import { execSync } from 'node:child_process';

export async function rollbackCommand(
  runId: string,
  opts: { force?: boolean; json?: boolean },
): Promise<void> {
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

  if (isTerminal(state.status) && !opts.force) {
    console.error(pc.red(`Run "${runId}" is in terminal state "${state.status}".`));
    console.error(pc.dim('Use --force to rollback a terminal run anyway.'));
    process.exit(1);
  }

  if (state.isolated && state.worktree_path) {
    // Isolated mode: remove the worktree (safe — main workspace untouched)
    console.log(pc.yellow(`Removing worktree: ${state.worktree_path}`));
    const result = removeWorktree(repoRoot, state.worktree_path, true);
    if (!result.success) {
      console.error(pc.red(`Failed to remove worktree: ${result.error}`));
      process.exit(1);
    }
    console.log(pc.green('Worktree removed.'));
  } else {
    // Non-isolated mode: require --force for safety
    if (!opts.force) {
      console.error(pc.red('Rollback in non-isolated mode will discard ALL uncommitted changes.'));
      console.error(pc.red('This includes changes unrelated to this run.'));
      console.error(pc.dim('Use --force if you are sure, or use --isolated runs in the future.'));
      process.exit(1);
    }

    console.log(pc.yellow('Discarding uncommitted changes...'));
    try {
      execSync('git checkout -- .', { cwd: repoRoot, encoding: 'utf-8', timeout: 10000 });
      console.log(pc.green('Working directory reset to last commit.'));
    } catch (err) {
      console.error(pc.red(`Failed to reset: ${String(err)}`));
      process.exit(1);
    }
  }

  // Mark run as stopped
  const stoppedState = {
    ...state,
    status: 'stopped' as const,
    completed_at: new Date().toISOString(),
  };
  writeFileSync(statusPath, JSON.stringify(stoppedState, null, 2), 'utf-8');

  if (opts.json) {
    console.log(JSON.stringify({ run_id: runId, status: 'stopped', rolled_back: true }, null, 2));
  } else {
    console.log(pc.green(`Run "${runId}" rolled back and stopped.`));
  }
}
