import { describe, it, expect } from 'vitest';
import {
  formatText,
  formatJson,
  formatSarif,
  formatJunit,
  formatDiagnostics,
} from '../src/format.js';
import { createError, createWarning, createInfo } from 'goalrun-core';

describe('formatText', () => {
  it("returns 'All checks passed' for empty diagnostics", () => {
    const output = formatText([]);
    expect(output).toContain('passed');
  });

  it('includes error count', () => {
    const diags = [createError('E001', 'broken')];
    const output = formatText(diags);
    expect(output).toContain('1 error');
  });

  it('includes warning count', () => {
    const diags = [createWarning('W001', 'careful')];
    const output = formatText(diags);
    expect(output).toContain('1 warning');
  });

  it('includes diagnostic code in output', () => {
    const diags = [createError('E001', 'something broke', { file: 'a.ts', line: 10 })];
    const output = formatText(diags);
    expect(output).toContain('E001');
    expect(output).toContain('something broke');
    expect(output).toContain('a.ts');
  });

  it('handles mixed severities', () => {
    const diags = [createError('E1', 'err'), createWarning('W1', 'warn'), createInfo('I1', 'info')];
    const output = formatText(diags);
    expect(output).toContain('1 error');
    expect(output).toContain('1 warning');
  });
});

describe('formatJson', () => {
  it('returns valid JSON with summary', () => {
    const diags = [createError('E001', 'broken', { file: 'a.ts' })];
    const json = formatJson(diags);
    const parsed = JSON.parse(json);
    expect(parsed.summary.errors).toBe(1);
    expect(parsed.diagnostics[0].code).toBe('E001');
    expect(parsed.diagnostics[0].message).toBe('broken');
    expect(parsed.diagnostics[0].file).toBe('a.ts');
  });

  it('handles empty diagnostics', () => {
    const json = formatJson([]);
    const parsed = JSON.parse(json);
    expect(parsed.summary.errors).toBe(0);
    expect(parsed.diagnostics).toHaveLength(0);
  });

  it('excludes undefined fields', () => {
    const diags = [createError('E001', 'msg')];
    const json = formatJson(diags);
    const parsed = JSON.parse(json);
    expect(parsed.diagnostics[0].file).toBeUndefined();
  });
});

describe('formatSarif', () => {
  it('returns valid SARIF v2.1.0 JSON with version and runs', () => {
    const result = formatSarif([]);
    const parsed = JSON.parse(result);
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.$schema).toContain('sarif-schema-2.1.0');
    expect(Array.isArray(parsed.runs)).toBe(true);
    expect(parsed.runs).toHaveLength(1);
  });

  it('includes tool metadata in tool.driver', () => {
    const result = formatSarif([]);
    const parsed = JSON.parse(result);
    const driver = parsed.runs[0].tool.driver;
    expect(driver.name).toBe('goalrun');
    expect(driver.informationUri).toContain('github');
    expect(driver.rules).toEqual([]);
  });

  it('maps each diagnostic to a result', () => {
    const diags = [createError('E001', 'broken', { file: 'a.ts' })];
    const result = formatSarif(diags);
    const parsed = JSON.parse(result);
    expect(parsed.runs[0].results).toHaveLength(1);
    expect(parsed.runs[0].results[0].ruleId).toBe('E001');
    expect(parsed.runs[0].results[0].message.text).toBe('broken');
  });

  it('maps diagnostic.file to SARIF locations', () => {
    const diags = [createError('E001', 'broken', { file: 'src/auth.ts', line: 42 })];
    const result = formatSarif(diags);
    const parsed = JSON.parse(result);
    const loc = parsed.runs[0].results[0].locations[0];
    expect(loc.physicalLocation.artifactLocation.uri).toBe('src/auth.ts');
    expect(loc.physicalLocation.region.startLine).toBe(42);
  });

  it('omits locations when file is absent', () => {
    const diags = [createError('E001', 'broken')];
    const result = formatSarif(diags);
    const parsed = JSON.parse(result);
    expect(parsed.runs[0].results[0].locations).toBeUndefined();
  });

  it('deduplicates reportingDescriptors by code', () => {
    const diags = [
      createError('E001', 'first'),
      createError('E001', 'second'),
      createWarning('W001', 'careful'),
    ];
    const result = formatSarif(diags);
    const parsed = JSON.parse(result);
    const rules = parsed.runs[0].tool.driver.rules;
    expect(rules).toHaveLength(2);
    const ruleIds = rules.map((r: { id: string }) => r.id);
    expect(ruleIds).toContain('E001');
    expect(ruleIds).toContain('W001');
  });

  it('maps severity to SARIF level', () => {
    const diags = [
      createError('E1', 'error'),
      createWarning('W1', 'warning'),
      createInfo('I1', 'info'),
    ];
    const result = formatSarif(diags);
    const parsed = JSON.parse(result);
    const levels = parsed.runs[0].results.map((r: { level: string }) => r.level);
    expect(levels).toEqual(['error', 'warning', 'note']);
  });

  it('handles empty diagnostics', () => {
    const result = formatSarif([]);
    const parsed = JSON.parse(result);
    expect(parsed.runs[0].results).toEqual([]);
  });
});

describe('formatJunit', () => {
  it('returns valid XML with testsuite root', () => {
    const result = formatJunit([]);
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<testsuite');
    expect(result).toContain('</testsuite>');
  });

  it('maps each diagnostic to a testcase', () => {
    const diags = [createError('E001', 'broken', { file: 'a.ts' })];
    const result = formatJunit(diags);
    expect(result).toContain('<testcase');
    expect(result).toContain('classname="a.ts"');
    expect(result).toContain('name="E001: broken"');
    expect(result).toContain('<failure');
  });

  it('maps classname to goalrun when file is absent', () => {
    const diags = [createError('E001', 'broken')];
    const result = formatJunit(diags);
    expect(result).toContain('classname="goalrun"');
  });

  it('maps warnings to skipped testcases', () => {
    const diags = [createWarning('W001', 'careful')];
    const result = formatJunit(diags);
    expect(result).toContain('<skipped');
    expect(result).toContain('W001: careful');
    expect(result).not.toContain('<failure');
  });

  it('maps infos to plain passing testcases', () => {
    const diags = [createInfo('I001', 'fyi')];
    const result = formatJunit(diags);
    expect(result).toContain('<testcase');
    expect(result).not.toContain('<failure');
    expect(result).not.toContain('<skipped');
  });

  it('reports correct test counts in testsuite attributes', () => {
    const diags = [createError('E1', 'err'), createWarning('W1', 'warn'), createInfo('I1', 'info')];
    const result = formatJunit(diags);
    expect(result).toContain('tests="3"');
    expect(result).toContain('failures="1"');
    expect(result).toContain('skipped="1"');
  });

  it('escapes XML entities in diagnostic content', () => {
    const diags = [createError('E001', 'a < b & c > "d"')];
    const result = formatJunit(diags);
    expect(result).toContain('a &lt; b &amp; c &gt; &quot;d&quot;');
    expect(result).not.toContain('a < b & c');
  });

  it('strips XML 1.0 forbidden control characters', () => {
    const diags = [createError('E001', 'msg\x00\x08\x0B')];
    const result = formatJunit(diags);
    expect(result).not.toContain('\x00');
    expect(result).not.toContain('\x08');
    expect(result).not.toContain('\x0B');
  });

  it('handles empty diagnostics with zero counts', () => {
    const result = formatJunit([]);
    expect(result).toContain('tests="0"');
    expect(result).toContain('failures="0"');
    expect(result).not.toContain('<testcase');
  });
});

describe('formatDiagnostics', () => {
  it('routes text format to formatText', () => {
    const result = formatDiagnostics([], 'text');
    expect(result).toContain('passed');
  });

  it('routes json format to formatJson', () => {
    const diags = [createError('E1', 'msg')];
    const result = formatDiagnostics(diags, 'json');
    const parsed = JSON.parse(result);
    expect(parsed.summary.errors).toBe(1);
  });

  it('routes sarif format to formatSarif', () => {
    const result = formatDiagnostics([], 'sarif');
    const parsed = JSON.parse(result);
    expect(parsed.version).toBe('2.1.0');
  });

  it('routes junit format to formatJunit', () => {
    const result = formatDiagnostics([], 'junit');
    expect(result).toContain('<testsuite');
  });
});
