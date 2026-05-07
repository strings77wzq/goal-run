import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import {
  isGitRepo,
  getMainBranch,
  createWorktree,
  isGoalrunManagedBranch,
  removeWorktree,
  listWorktrees,
  hasWorktrees,
  setGitRunnerForTesting,
} from '../src/worktree.js';

describe('worktree management', () => {
  let repoRoot: string;

  beforeAll(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'goalrun-wt-test-'));
    execSync('git init', { cwd: repoRoot });
    execSync('git config user.email "test@test.com"', { cwd: repoRoot });
    execSync('git config user.name "Test"', { cwd: repoRoot });
    execSync('touch README.md && git add README.md && git commit -m "initial"', { cwd: repoRoot });
  });

  afterAll(() => {
    setGitRunnerForTesting(null);
    rmSync(repoRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    setGitRunnerForTesting(null);
  });

  describe('isGitRepo', () => {
    it('returns true for a git repo', () => {
      expect(isGitRepo(repoRoot)).toBe(true);
    });

    it('returns false for a non-git directory', () => {
      const nonGit = mkdtempSync(join(tmpdir(), 'goalrun-non-git-'));
      expect(isGitRepo(nonGit)).toBe(false);
      rmSync(nonGit, { recursive: true, force: true });
    });
  });

  describe('getMainBranch', () => {
    it('returns a branch name', () => {
      const branch = getMainBranch(repoRoot);
      expect(typeof branch).toBe('string');
      expect(branch.length).toBeGreaterThan(0);
    });
  });

  describe('createWorktree / removeWorktree', () => {
    it('creates and removes a worktree', () => {
      const wtPath = '.goalrun/runs/test-run/worktree';
      const fullWtPath = resolve(repoRoot, wtPath);

      // Create
      const createResult = createWorktree(repoRoot, wtPath);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        expect(createResult.path).toBe(fullWtPath);

        // Verify it exists in worktree list
        const list = listWorktrees(repoRoot);
        expect(
          list.find((w) => w.path === fullWtPath || w.path === createResult.path),
        ).toBeTruthy();

        // Remove
        const removeResult = removeWorktree(repoRoot, wtPath, true);
        expect(removeResult.success).toBe(true);

        // Verify removed
        const afterList = listWorktrees(repoRoot);
        expect(afterList.find((w) => w.path === fullWtPath)).toBeUndefined();
      }
    });

    it('returns error for non-git repo', () => {
      const nonGit = mkdtempSync(join(tmpdir(), 'goalrun-non-git-2-'));
      const result = createWorktree(nonGit, 'work');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Not a git repository');
      }
      rmSync(nonGit, { recursive: true, force: true });
    });

    it('rejects path traversal in worktree path', () => {
      const result = createWorktree(repoRoot, '../outside');
      expect(result.success).toBe(false);
    });

    it('rejects absolute worktree creation paths outside the repo root', () => {
      const outsidePath = join(tmpdir(), `goalrun-outside-${Date.now()}`, 'worktree');
      const result = createWorktree(repoRoot, outsidePath);
      if (result.success) {
        removeWorktree(repoRoot, outsidePath, true);
        execSync(`git branch -D ${result.branch}`, { cwd: repoRoot });
      }
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/within the repo root/i);
      }
    });

    it('rejects removal paths outside the repo root before git removal', () => {
      const result = removeWorktree(repoRoot, '../outside', true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/within the repo root/i);
      }
    });

    it('invokes worktree creation with structured git arguments', () => {
      const calls: { cwd: string; args: string[]; timeout: number }[] = [];
      setGitRunnerForTesting((cwd, args, timeout) => {
        calls.push({ cwd, args, timeout });
        return '';
      });

      const result = createWorktree(repoRoot, '.goalrun/runs/args/worktree');
      expect(result.success).toBe(true);

      expect(calls[0]?.args).toEqual([
        'worktree',
        'add',
        '--detach',
        resolve(repoRoot, '.goalrun/runs/args/worktree'),
        'HEAD',
      ]);
      expect(calls[1]?.args.slice(0, 2)).toEqual(['checkout', '-b']);
      expect(calls[1]?.args[2]).toMatch(/^goalrun-\d+$/);
    });

    it('invokes worktree removal with structured git arguments', () => {
      const calls: { cwd: string; args: string[]; timeout: number }[] = [];
      setGitRunnerForTesting((cwd, args, timeout) => {
        calls.push({ cwd, args, timeout });
        return '';
      });

      const wtPath = '.goalrun/runs/remove-args/worktree';
      mkdirSync(resolve(repoRoot, wtPath), { recursive: true });

      const result = removeWorktree(repoRoot, wtPath, true);
      expect(result.success).toBe(true);
      expect(calls[0]).toEqual({
        cwd: repoRoot,
        args: ['worktree', 'remove', '--force', resolve(repoRoot, wtPath)],
        timeout: 10000,
      });

      rmSync(resolve(repoRoot, '.goalrun/runs/remove-args'), { recursive: true, force: true });
    });
  });

  describe('isGoalrunManagedBranch', () => {
    it('accepts branches created by GoalRun', () => {
      expect(isGoalrunManagedBranch('goalrun-1778125121000')).toBe(true);
    });

    it('rejects unmanaged or shell-shaped branch names', () => {
      expect(isGoalrunManagedBranch('main')).toBe(false);
      expect(isGoalrunManagedBranch('feature/work')).toBe(false);
      expect(isGoalrunManagedBranch('goalrun-abc')).toBe(false);
      expect(isGoalrunManagedBranch('goalrun-1;git branch -D main')).toBe(false);
    });
  });

  describe('hasWorktrees', () => {
    it('returns false when only main worktree exists', () => {
      expect(hasWorktrees(repoRoot)).toBe(false);
    });
  });
});
