import { describe, it, expect } from 'vitest';
import {
  getStageRole,
  checkRoleBoundary,
  checkRoleBoundariesForFiles,
} from '../src/role-boundary.js';

describe('getStageRole', () => {
  it('returns role for dev stage', () => {
    const role = getStageRole('dev');
    expect(role.stage).toBe('dev');
    expect(role.allowedOperations).toContain('read');
    expect(role.allowedOperations).toContain('write');
  });

  it('returns role for review stage (read-only)', () => {
    const role = getStageRole('review');
    expect(role.stage).toBe('review');
    expect(role.allowedOperations).toEqual(['read']);
    expect(role.deniedPaths).toEqual([]);
  });

  it('returns role for design stage with restricted writes', () => {
    const role = getStageRole('design');
    expect(role.allowedOperations).toContain('write');
    expect(role.deniedPaths).toContain('src/**');
  });
});

describe('checkRoleBoundary', () => {
  it('allows reading any file in change stage', () => {
    const result = checkRoleBoundary('change', 'src/index.ts', 'read');
    expect(result.allowed).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it('denies writing in change stage', () => {
    const result = checkRoleBoundary('change', 'src/index.ts', 'write');
    expect(result.allowed).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('ROLE_OPERATION_DENIED');
  });

  it('allows writing source files in dev stage', () => {
    const result = checkRoleBoundary('dev', 'src/index.ts', 'write');
    expect(result.allowed).toBe(true);
  });

  it('denies writing policy files in dev stage', () => {
    const result = checkRoleBoundary('dev', '.goalrun/policy.yaml', 'write');
    expect(result.allowed).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('ROLE_PATH_DENIED');
  });

  it('allows reading any file in review stage', () => {
    const result = checkRoleBoundary('review', 'src/index.ts', 'read');
    expect(result.allowed).toBe(true);
  });

  it('denies writing in review stage', () => {
    const result = checkRoleBoundary('review', 'src/index.ts', 'write');
    expect(result.allowed).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('ROLE_OPERATION_DENIED');
  });

  it('allows writing design docs in design stage', () => {
    const result = checkRoleBoundary('design', 'docs/architecture.md', 'write');
    expect(result.allowed).toBe(true);
  });

  it('denies writing source in design stage', () => {
    const result = checkRoleBoundary('design', 'src/index.ts', 'write');
    expect(result.allowed).toBe(false);
  });

  it('allows writing lessons in integration stage', () => {
    const result = checkRoleBoundary('integration', '.goalrun/lessons.json', 'write');
    expect(result.allowed).toBe(true);
  });

  it('denies writing source in integration stage', () => {
    const result = checkRoleBoundary('integration', 'src/index.ts', 'write');
    expect(result.allowed).toBe(false);
  });
});

describe('checkRoleBoundariesForFiles', () => {
  it('reports all allowed when within boundaries', () => {
    const result = checkRoleBoundariesForFiles('dev', [
      { path: 'src/index.ts', operation: 'write' },
      { path: 'test/index.test.ts', operation: 'write' },
    ]);
    expect(result.allAllowed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('reports violations when outside boundaries', () => {
    const result = checkRoleBoundariesForFiles('dev', [
      { path: 'src/index.ts', operation: 'write' },
      { path: '.goalrun/policy.yaml', operation: 'write' },
    ]);
    expect(result.allAllowed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.file).toBe('.goalrun/policy.yaml');
  });

  it('reports multiple violations', () => {
    const result = checkRoleBoundariesForFiles('review', [
      { path: 'src/index.ts', operation: 'write' },
      { path: 'src/utils.ts', operation: 'write' },
    ]);
    expect(result.allAllowed).toBe(false);
    expect(result.violations).toHaveLength(2);
  });
});
