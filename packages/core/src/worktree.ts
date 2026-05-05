import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function isGitRepo(repoRoot: string): boolean {
  return existsSync(resolve(repoRoot, '.git'));
}

export function getMainBranch(repoRoot: string): string {
  try {
    const result = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 5000,
    });
    return result.trim();
  } catch {
    return 'main';
  }
}

export function createWorktree(
  repoRoot: string,
  worktreePath: string,
): { success: true; path: string; branch: string } | { success: false; error: string } {
  if (!isGitRepo(repoRoot)) {
    return { success: false, error: 'Not a git repository. --isolated requires a git repo.' };
  }

  if (worktreePath.includes('..')) {
    return { success: false, error: 'Worktree path must be within the repo root.' };
  }

  const fullPath = resolve(repoRoot, worktreePath);
  const branchName = `goalrun-${Date.now()}`;

  try {
    // Create a detached worktree from HEAD, then branch off
    execSync(`git worktree add --detach "${fullPath}" HEAD`, {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 15000,
    });

    execSync(`git checkout -b ${branchName}`, {
      cwd: fullPath,
      encoding: 'utf-8',
      timeout: 5000,
    });

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
  const fullPath = resolve(repoRoot, worktreePath);

  if (!existsSync(fullPath)) {
    return { success: false, error: `Worktree not found: ${worktreePath}` };
  }

  try {
    const flag = force ? ' --force' : '';
    execSync(`git worktree remove${flag} "${fullPath}"`, {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to remove worktree: ${String(err)}` };
  }
}

export function listWorktrees(repoRoot: string): { path: string; branch: string; head: string }[] {
  try {
    const output = execSync('git worktree list', {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 5000,
    });
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
