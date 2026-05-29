import { describe, it, expect } from 'vitest';
import { verifyEvidenceExists } from '../src/verification.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('verifyEvidenceExists', () => {
  it('returns success when all required evidence files exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'goalrun-test-'));
    const verDir = join(dir, 'verification');
    mkdirSync(verDir, { recursive: true });
    writeFileSync(join(verDir, 'red-phase.txt'), 'FAILED test output');
    writeFileSync(join(verDir, 'green-phase.txt'), 'PASSED test output');

    const result = verifyEvidenceExists(verDir, ['red-phase.txt', 'green-phase.txt']);
    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.evidence['red-phase.txt']).toBe('FAILED test output');
  });

  it('returns failure when evidence files are missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'goalrun-test-'));
    const verDir = join(dir, 'verification');
    mkdirSync(verDir, { recursive: true });
    writeFileSync(join(verDir, 'red-phase.txt'), 'FAILED');

    const result = verifyEvidenceExists(verDir, ['red-phase.txt', 'green-phase.txt']);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('EVIDENCE_MISSING');
  });

  it('returns failure when verification directory does not exist', () => {
    const result = verifyEvidenceExists('/nonexistent', ['red-phase.txt']);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
  });
});
