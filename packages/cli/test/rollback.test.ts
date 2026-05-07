import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createWorktree } from 'goalrun-core';
import { rollbackCommand, setRollbackGitRunnerForTesting } from '../src/commands/rollback.js';

function createGitRepo(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'goalrun-rollback-test-'));
  execSync('git init', { cwd: tempDir });
  execSync('git config user.email "test@test.com"', { cwd: tempDir });
  execSync('git config user.name "Test"', { cwd: tempDir });
  writeFileSync(resolve(tempDir, 'README.md'), '# Test repo\n', 'utf-8');
  execSync('git add . && git commit -m "initial"', { cwd: tempDir });
  return tempDir;
}

describe('rollbackCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setRollbackGitRunnerForTesting(null);
  });

  it('does not delete unmanaged branch names from persisted run state', async () => {
    const repoRoot = createGitRepo();
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);

    const currentBranch = execFileSync('git', ['branch', '--show-current'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    }).trim();
    const runId = 'test-run';
    const worktreePath = `.goalrun/runs/${runId}/worktree`;
    const worktreeResult = createWorktree(repoRoot, worktreePath);
    expect(worktreeResult.success).toBe(true);

    const runDir = resolve(repoRoot, '.goalrun/runs', runId);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      resolve(runDir, 'status.json'),
      JSON.stringify(
        {
          run_id: runId,
          goal_id: 'goal',
          status: 'waiting_for_user',
          iteration: 1,
          max_iterations: 5,
          skills: [],
          criteria: [{ text: 'criterion', status: 'pending' }],
          started_at: new Date().toISOString(),
          checkpoints: [],
          budget: {
            max_iterations: 5,
            max_changed_files: 10,
            max_runtime_minutes: 60,
          },
          policy_gates: [],
          isolated: true,
          worktree_path: worktreePath,
          branch_name: currentBranch,
        },
        null,
        2,
      ),
      'utf-8',
    );

    await rollbackCommand(runId, { force: false, json: true });

    const branches = execFileSync('git', ['branch', '--format=%(refname:short)'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    expect(branches.split('\n')).toContain(currentBranch);

    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('rejects run ids that resolve outside the configured runs directory', async () => {
    const repoRoot = createGitRepo();
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null): never => {
        throw new Error(`process.exit(${code})`);
      });

    await expect(rollbackCommand('../../outside', { force: false, json: true })).rejects.toThrow(
      /outside the runs directory/i,
    );
    expect(mockExit).not.toHaveBeenCalled();

    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('passes managed branch deletion to git as structured arguments', async () => {
    const repoRoot = createGitRepo();
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);

    const calls: { cwd: string; args: string[]; timeout: number }[] = [];
    setRollbackGitRunnerForTesting((cwd, args, timeout) => {
      calls.push({ cwd, args, timeout });
      return '';
    });

    const runId = 'managed-branch-run';
    const worktreePath = `.goalrun/runs/${runId}/worktree`;
    const worktreeResult = createWorktree(repoRoot, worktreePath);
    expect(worktreeResult.success).toBe(true);

    const runDir = resolve(repoRoot, '.goalrun/runs', runId);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      resolve(runDir, 'status.json'),
      JSON.stringify(
        {
          run_id: runId,
          goal_id: 'goal',
          status: 'waiting_for_user',
          iteration: 1,
          max_iterations: 5,
          skills: [],
          criteria: [{ text: 'criterion', status: 'pending' }],
          started_at: new Date().toISOString(),
          checkpoints: [],
          budget: {
            max_iterations: 5,
            max_changed_files: 10,
            max_runtime_minutes: 60,
          },
          policy_gates: [],
          isolated: true,
          worktree_path: worktreePath,
          branch_name: 'goalrun-1778125121000',
        },
        null,
        2,
      ),
      'utf-8',
    );

    await rollbackCommand(runId, { force: false, json: true });

    expect(calls).toContainEqual({
      cwd: repoRoot,
      args: ['branch', '-D', 'goalrun-1778125121000'],
      timeout: 5000,
    });

    rmSync(repoRoot, { recursive: true, force: true });
  });
});
