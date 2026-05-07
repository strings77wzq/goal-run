import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const GOALRUN_BRANCH_PREFIX = 'goalrun-';

export function isGoalrunManagedBranch(branchName: string): boolean {
  return new RegExp(`^${GOALRUN_BRANCH_PREFIX}\\d+$`).test(branchName);
}

export type GitRunner = (cwd: string, args: string[], timeout: number) => string;

let gitRunner: GitRunner = runGitProcess;

export function setGitRunnerForTesting(runner: GitRunner | null): void {
  gitRunner = runner ?? runGitProcess;
}

export function isGitRepo(repoRoot: string): boolean {
  return existsSync(resolve(repoRoot, '.git'));
}

export function getMainBranch(repoRoot: string): string {
  try {
    const result = runGit(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], 5000);
    return result.trim();
  } catch {
    return 'main';
  }
}

function resolveContainedPath(
  repoRoot: string,
  candidatePath: string,
): { success: true; path: string } | { success: false; error: string } {
  const fullPath = resolve(repoRoot, candidatePath);
  const rel = relative(repoRoot, fullPath);

  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return { success: false, error: 'Worktree path must be within the repo root.' };
  }

  return { success: true, path: fullPath };
}

function runGit(cwd: string, args: string[], timeout: number): string {
  return gitRunner(cwd, args, timeout);
}

function runGitProcess(cwd: string, args: string[], timeout: number): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    timeout,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
}

export function createWorktree(
  repoRoot: string,
  worktreePath: string,
): { success: true; path: string; branch: string } | { success: false; error: string } {
  if (!isGitRepo(repoRoot)) {
    return { success: false, error: 'Not a git repository. --isolated requires a git repo.' };
  }

  const contained = resolveContainedPath(repoRoot, worktreePath);
  if (!contained.success) {
    return contained;
  }

  const fullPath = contained.path;
  const branchName = `${GOALRUN_BRANCH_PREFIX}${Date.now()}`;

  try {
    // Create a detached worktree from HEAD, then branch off
    runGit(repoRoot, ['worktree', 'add', '--detach', fullPath, 'HEAD'], 15000);
    runGit(fullPath, ['checkout', '-b', branchName], 5000);

    return { success: true, path: fullPath, branch: branchName };
  } catch (err) {
    return { success: false, error: `Failed to create worktree: ${String(err)}` };
  }
}

export function removeWorktree(
  repoRoot: string,
  worktreePath: string,
  force = false,
): { success: true } | { success: false; error: string } {
  const contained = resolveContainedPath(repoRoot, worktreePath);
  if (!contained.success) {
    return contained;
  }

  const fullPath = contained.path;

  if (!existsSync(fullPath)) {
    return { success: false, error: `Worktree not found: ${worktreePath}` };
  }

  try {
    runGit(repoRoot, ['worktree', 'remove', ...(force ? ['--force'] : []), fullPath], 10000);
    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to remove worktree: ${String(err)}` };
  }
}

export function listWorktrees(repoRoot: string): { path: string; branch: string; head: string }[] {
  try {
    const output = runGit(repoRoot, ['worktree', 'list'], 5000);
    return output
      .trim()
      .split('\n')
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const path = parts[0] ?? '';
        const head = (parts[1] ?? '').replace(/^\[|\]$/g, '');
        const branch = parts[2]
          ? parts
              .slice(2)
              .join(' ')
              .replace(/^\[|\]$/g, '')
          : '';
        return { path, branch, head };
      });
  } catch {
    return [];
  }
}

export function hasWorktrees(repoRoot: string): boolean {
  return listWorktrees(repoRoot).length > 1;
}
