import { describe, it, expect } from 'vitest';
import {
  DiagnosticSchema,
  createError,
  createWarning,
  createInfo,
  type Diagnostic,
} from '../src/diagnostic.js';

describe('DiagnosticSchema', () => {
  it('validates a minimal error diagnostic', () => {
    const diag = {
      code: 'E001',
      severity: 'error' as const,
      message: 'something broke',
    };
    const result = DiagnosticSchema.safeParse(diag);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('E001');
      expect(result.data.severity).toBe('error');
      expect(result.data.message).toBe('something broke');
      expect(result.data.file).toBeUndefined();
      expect(result.data.line).toBeUndefined();
      expect(result.data.hint).toBeUndefined();
    }
  });

  it('validates a full diagnostic with all optional fields', () => {
    const diag = {
      code: 'W001',
      severity: 'warning' as const,
      message: 'consider using const',
      file: 'src/foo.ts',
      line: 42,
      hint: 'use const instead of let',
    };
    const result = DiagnosticSchema.safeParse(diag);
    expect(result.success).toBe(true);
  });

  it('rejects invalid severity', () => {
    const diag = { code: 'X', severity: 'critical', message: 'bad' };
    const result = DiagnosticSchema.safeParse(diag);
    expect(result.success).toBe(false);
  });

  it('rejects missing code', () => {
    const diag = { severity: 'error', message: 'bad' };
    const result = DiagnosticSchema.safeParse(diag);
    expect(result.success).toBe(false);
  });

  it('rejects missing message', () => {
    const diag = { code: 'E001', severity: 'error' };
    const result = DiagnosticSchema.safeParse(diag);
    expect(result.success).toBe(false);
  });

  it('rejects empty string code', () => {
    const diag = { code: '', severity: 'error', message: 'bad' };
    const result = DiagnosticSchema.safeParse(diag);
    expect(result.success).toBe(false);
  });

  it('rejects zero or negative line numbers', () => {
    expect(
      DiagnosticSchema.safeParse({ code: 'E', severity: 'error', message: 'x', line: 0 }).success,
    ).toBe(false);
    expect(
      DiagnosticSchema.safeParse({ code: 'E', severity: 'error', message: 'x', line: -1 }).success,
    ).toBe(false);
  });

  it('rejects non-integer line numbers', () => {
    const result = DiagnosticSchema.safeParse({
      code: 'E',
      severity: 'error',
      message: 'x',
      line: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts info severity', () => {
    const result = DiagnosticSchema.safeParse({ code: 'I001', severity: 'info', message: 'FYI' });
    expect(result.success).toBe(true);
  });

  it('Diagnostic type is usable as a type annotation', () => {
    const d: Diagnostic = { code: 'E001', severity: 'error', message: 'test' };
    expect(d.code).toBe('E001');
  });
});

describe('createError', () => {
  it('creates an error diagnostic with required fields', () => {
    const d = createError('E001', 'something failed');
    expect(d.severity).toBe('error');
    expect(d.code).toBe('E001');
    expect(d.message).toBe('something failed');
    expect(d.file).toBeUndefined();
  });

  it('creates an error diagnostic with optional fields', () => {
    const d = createError('E002', 'bad config', {
      file: 'config.yaml',
      line: 10,
      hint: 'check schema',
    });
    expect(d.file).toBe('config.yaml');
    expect(d.line).toBe(10);
    expect(d.hint).toBe('check schema');
  });

  it('passes schema validation', () => {
    const d = createError('E003', 'invalid');
    expect(DiagnosticSchema.safeParse(d).success).toBe(true);
  });
});

describe('createWarning', () => {
  it('creates a warning diagnostic', () => {
    const d = createWarning('W001', 'deprecated API');
    expect(d.severity).toBe('warning');
    expect(d.code).toBe('W001');
  });
});

describe('createInfo', () => {
  it('creates an info diagnostic', () => {
    const d = createInfo('I001', 'all checks passed');
    expect(d.severity).toBe('info');
  });
});
