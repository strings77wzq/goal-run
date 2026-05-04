import { describe, it, expect } from 'vitest';
import { resolveSafe } from 'goalrun-core';

describe('CLI path safety (resolveSafe on user inputs)', () => {
  const repoRoot = '/home/user/project';

  it('accepts a normal relative path within the repo', () => {
    expect(() => resolveSafe(repoRoot, '.goalrun/goals/fix-bug.yaml')).not.toThrow();
  });

  it('accepts an absolute path within the repo', () => {
    expect(() =>
      resolveSafe(repoRoot, '/home/user/project/.goalrun/goals/fix-bug.yaml'),
    ).not.toThrow();
  });

  it('rejects path traversal via ..', () => {
    expect(() => resolveSafe(repoRoot, '../../../etc/passwd')).toThrow(/outside repo root/i);
  });

  it('rejects absolute path outside repo', () => {
    expect(() => resolveSafe(repoRoot, '/etc/passwd')).toThrow(/outside repo root/i);
  });

  it('rejects path traversal in nested paths', () => {
    expect(() => resolveSafe(repoRoot, '.goalrun/../../../etc/shadow')).toThrow(
      /outside repo root/i,
    );
  });

  it('rejects symlink-like traversal patterns', () => {
    expect(() => resolveSafe(repoRoot, 'foo/../bar/../../outside')).toThrow(/outside repo root/i);
  });

  it('accepts "." as repo root', () => {
    const resolved = resolveSafe(repoRoot, '.');
    expect(resolved).toBe(repoRoot);
  });

  it('rejects empty string path traversal to parent', () => {
    expect(() => resolveSafe(repoRoot, '..')).toThrow(/outside repo root/i);
  });
});
