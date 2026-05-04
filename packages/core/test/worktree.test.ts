import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import {
  isGitRepo,
  getMainBranch,
  createWorktree,
  removeWorktree,
  listWorktrees,
  hasWorktrees,
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
    rmSync(repoRoot, { recursive: true, force: true });
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
  });

  describe('hasWorktrees', () => {
    it('returns false when only main worktree exists', () => {
      expect(hasWorktrees(repoRoot)).toBe(false);
    });
  });
});
