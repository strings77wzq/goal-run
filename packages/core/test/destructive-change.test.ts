import { describe, it, expect } from 'vitest';
import { checkAbstractionReuse } from '../src/destructive-change.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('checkAbstractionReuse', () => {
  it('finds existing abstractions with matching names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'goalrun-test-'));
    const utilsDir = join(dir, 'src', 'utils');
    mkdirSync(utilsDir, { recursive: true });
    writeFileSync(join(utilsDir, 'format.ts'), 'export function formatDate() {}');

    const result = checkAbstractionReuse(dir, 'formatDate', join(dir, 'src'));
    expect(result.exists).toBe(true);
    expect(result.locations.length).toBeGreaterThan(0);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].code).toBe('ABSTRACTION_REUSE_CANDIDATE');
  });

  it('returns empty when no matching abstractions found', () => {
    const dir = mkdtempSync(join(tmpdir(), 'goalrun-test-'));
    const srcDir = join(dir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'other.ts'), 'export function otherFunc() {}');

    const result = checkAbstractionReuse(dir, 'nonExistentFunc', srcDir);
    expect(result.exists).toBe(false);
    expect(result.locations).toHaveLength(0);
  });

  it('handles missing directories gracefully', () => {
    const result = checkAbstractionReuse('/nonexistent', 'test', '/nonexistent/src');
    expect(result.exists).toBe(false);
    expect(result.diagnostics).toHaveLength(0);
  });
});
