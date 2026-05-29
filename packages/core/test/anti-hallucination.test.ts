import { describe, it, expect } from 'vitest';
import { checkAntiHallucination } from '../src/anti-hallucination.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('checkAntiHallucination', () => {
  it('detects debug statements in code', () => {
    const dir = mkdtempSync(join(tmpdir(), 'goalrun-test-'));
    const files = [
      {
        path: 'src/test.ts',
        content: 'console.log("debug");\nconsole.error("error");\nexport function foo() {}',
      },
    ];

    const result = checkAntiHallucination(dir, files);
    expect(result.diagnostics.some((d) => d.code === 'DEBUG_STATEMENT_REMAINING')).toBe(true);
  });

  it('passes clean code without debug statements', () => {
    const dir = mkdtempSync(join(tmpdir(), 'goalrun-test-'));
    const files = [
      {
        path: 'src/clean.ts',
        content: 'export function clean(): string { return "hello"; }',
      },
    ];

    const result = checkAntiHallucination(dir, files);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('handles empty file list', () => {
    const result = checkAntiHallucination('/tmp', []);
    expect(result.passed).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });
});
