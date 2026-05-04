import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import {
  captureDiff,
  captureFullDiff,
  captureStagedDiff,
  getChangedFiles,
  getChangeStats,
  saveDiffPatch,
} from '../src/diff.js';

describe('diff capture', () => {
  let repoRoot: string;

  beforeAll(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'goalrun-diff-test-'));
    execSync('git init', { cwd: repoRoot });
    execSync('git config user.email "test@test.com"', { cwd: repoRoot });
    execSync('git config user.name "Test"', { cwd: repoRoot });

    // Create and commit initial tracked files
    writeFileSync(join(repoRoot, 'README.md'), '# Initial');
    writeFileSync(join(repoRoot, 'tracked.txt'), 'tracked content');
    execSync('git add README.md tracked.txt && git commit -m "initial"', { cwd: repoRoot });
  });

  afterAll(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  describe('captureDiff', () => {
    it('returns empty diff on clean repo', () => {
      const result = captureDiff(repoRoot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.diff).toBe('(no changes)');
      }
    });

    it('captures unstaged changes to tracked file', () => {
      writeFileSync(join(repoRoot, 'tracked.txt'), 'modified');
      const result = captureDiff(repoRoot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.diff).toContain('modified');
        expect(result.diff).not.toBe('(no changes)');
      }
      // Restore
      writeFileSync(join(repoRoot, 'tracked.txt'), 'tracked content');
    });

    it('captures staged change via staged diff', () => {
      writeFileSync(join(repoRoot, 'tracked.txt'), 'staged change');
      execSync('git add tracked.txt', { cwd: repoRoot });

      const result = captureStagedDiff(repoRoot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.diff).toContain('staged change');
      }

      execSync('git reset HEAD tracked.txt', { cwd: repoRoot });
      writeFileSync(join(repoRoot, 'tracked.txt'), 'tracked content');
    });
  });

  describe('captureStagedDiff', () => {
    it('captures staged but not unstaged changes', () => {
      writeFileSync(join(repoRoot, 'tracked.txt'), 'staged-only');
      execSync('git add tracked.txt', { cwd: repoRoot });

      const result = captureStagedDiff(repoRoot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.diff).toContain('staged-only');
      }

      execSync('git reset HEAD tracked.txt', { cwd: repoRoot });
      writeFileSync(join(repoRoot, 'tracked.txt'), 'tracked content');
    });
  });

  describe('captureFullDiff', () => {
    it('returns full diff from HEAD', () => {
      writeFileSync(join(repoRoot, 'tracked.txt'), 'changed from HEAD');
      const result = captureFullDiff(repoRoot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.diff).toContain('changed from HEAD');
      }
      writeFileSync(join(repoRoot, 'tracked.txt'), 'tracked content');
    });
  });

  describe('getChangedFiles', () => {
    it('returns empty array on clean repo', () => {
      expect(getChangedFiles(repoRoot)).toEqual([]);
    });

    it('returns list of modified tracked files', () => {
      writeFileSync(join(repoRoot, 'tracked.txt'), 'modified');
      writeFileSync(join(repoRoot, 'README.md'), '# Modified readme');
      const files = getChangedFiles(repoRoot);
      expect(files).toContain('tracked.txt');
      expect(files).toContain('README.md');
      writeFileSync(join(repoRoot, 'tracked.txt'), 'tracked content');
      writeFileSync(join(repoRoot, 'README.md'), '# Initial');
    });
  });

  describe('getChangeStats', () => {
    it('returns zero stats on clean repo', () => {
      const stats = getChangeStats(repoRoot);
      expect(stats.files).toBe(0);
    });

    it('counts modified tracked files', () => {
      writeFileSync(join(repoRoot, 'tracked.txt'), 'modified');
      writeFileSync(join(repoRoot, 'README.md'), '# Changed');
      const stats = getChangeStats(repoRoot);
      expect(stats.files).toBe(2);
      writeFileSync(join(repoRoot, 'tracked.txt'), 'tracked content');
      writeFileSync(join(repoRoot, 'README.md'), '# Initial');
    });
  });

  describe('saveDiffPatch', () => {
    it('saves diff to a file', () => {
      writeFileSync(join(repoRoot, 'tracked.txt'), 'patch change');
      const outPath = resolve(repoRoot, 'tmp', 'changes.diff');
      const result = saveDiffPatch(repoRoot, outPath);
      expect(result.success).toBe(true);
      const saved = readFileSync(outPath, 'utf-8');
      expect(saved).toContain('patch change');
      writeFileSync(join(repoRoot, 'tracked.txt'), 'tracked content');
      rmSync(resolve(repoRoot, 'tmp'), { recursive: true, force: true });
    });
  });
});
