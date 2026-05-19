import type { Diagnostic } from 'goalrun-core';
import pc from 'picocolors';

export function formatText(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return pc.green('All checks passed. No issues found.');
  }

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const infos = diagnostics.filter((d) => d.severity === 'info');

  const lines: string[] = [];

  // Summary
  const parts: string[] = [];
  if (errors.length > 0)
    parts.push(pc.red(`${errors.length} error${errors.length > 1 ? 's' : ''}`));
  if (warnings.length > 0)
    parts.push(pc.yellow(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`));
  if (infos.length > 0) parts.push(pc.blue(`${infos.length} info`));
  lines.push(`Found ${parts.join(', ')}.`);
  lines.push('');

  // Print errors first
  for (const d of diagnostics) {
    const icon =
      d.severity === 'error'
        ? pc.red('✖')
        : d.severity === 'warning'
          ? pc.yellow('⚠')
          : pc.blue('ℹ');
    const loc = d.file ? (d.line ? ` ${d.file}:${d.line}` : ` ${d.file}`) : '';
    lines.push(`${icon} ${d.severity.toUpperCase()} ${d.code}${loc}`);
    lines.push(`  ${d.message}`);
    if (d.hint) {
      lines.push(`  ${pc.dim(`Hint: ${d.hint}`)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export interface JsonReport {
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  diagnostics: {
    code: string;
    severity: string;
    message: string;
    file?: string;
    line?: number;
    hint?: string;
  }[];
}

export function formatJson(diagnostics: Diagnostic[]): string {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  const infos = diagnostics.filter((d) => d.severity === 'info').length;

  const report: JsonReport = {
    summary: {
      total: diagnostics.length,
      errors,
      warnings,
      infos,
    },
    diagnostics: diagnostics.map((d) => {
      const item: JsonReport['diagnostics'][number] = {
        code: d.code,
        severity: d.severity,
        message: d.message,
      };
      if (d.file !== undefined) item.file = d.file;
      if (d.line !== undefined) item.line = d.line;
      if (d.hint !== undefined) item.hint = d.hint;
      return item;
    }),
  };

  return JSON.stringify(report, null, 2);
}

// ── Shared dispatch ──

export type FormatType = 'text' | 'json' | 'sarif' | 'junit';

export function formatDiagnostics(diagnostics: Diagnostic[], format: FormatType): string {
  switch (format) {
    case 'text':
      return formatText(diagnostics);
    case 'json':
      return formatJson(diagnostics);
    case 'sarif':
      return formatSarif(diagnostics);
    case 'junit':
      return formatJunit(diagnostics);
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unknown format: ${String(_exhaustive)}. Valid: text, json, sarif, junit`);
    }
  }
}

// ── SARIF v2.1.0 ──

const SARIF_SCHEMA =
  'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';

const SARIF_TOOL = {
  driver: {
    name: 'goalrun',
    informationUri: 'https://github.com/strings77wzq/goal-run',
  },
};

const SEVERITY_TO_LEVEL: Record<string, string> = {
  error: 'error',
  warning: 'warning',
  info: 'note',
};

export function formatSarif(diagnostics: Diagnostic[]): string {
  const seenCodes = new Set<string>();
  const rules: { id: string; shortDescription: { text: string } }[] = [];

  for (const d of diagnostics) {
    if (!seenCodes.has(d.code)) {
      seenCodes.add(d.code);
      rules.push({ id: d.code, shortDescription: { text: d.message } });
    }
  }

  const results = diagnostics.map((d) => {
    const result: Record<string, unknown> = {
      ruleId: d.code,
      level: SEVERITY_TO_LEVEL[d.severity] ?? 'none',
      message: { text: d.message },
    };
    if (d.file !== undefined) {
      const loc: Record<string, unknown> = {
        physicalLocation: { artifactLocation: { uri: d.file } },
      };
      if (d.line !== undefined) {
        (loc.physicalLocation as Record<string, unknown>).region = { startLine: d.line };
      }
      result.locations = [loc];
    }
    return result;
  });

  const doc = {
    version: '2.1.0',
    $schema: SARIF_SCHEMA,
    runs: [
      {
        tool: { ...SARIF_TOOL, driver: { ...SARIF_TOOL.driver, rules } },
        results,
      },
    ],
  };

  return JSON.stringify(doc, null, 2);
}

// ── JUnit XML ──

const XML_FORBIDDEN = /[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF\uD800-\uDFFF]/g;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(XML_FORBIDDEN, '');
}

export function formatJunit(diagnostics: Diagnostic[]): string {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const skipped = diagnostics.filter((d) => d.severity === 'warning').length;
  const total = diagnostics.length;

  let testcases = '';
  for (const d of diagnostics) {
    const name = escapeXml(`${d.code}: ${d.message}`);
    const classname = escapeXml(d.file ?? 'goalrun');
    const inner =
      d.severity === 'error'
        ? `<failure message="${escapeXml(d.message)}" type="${escapeXml(d.code)}"/>`
        : d.severity === 'warning'
          ? `<skipped message="${escapeXml(d.message)}"/>`
          : '';
    testcases += `    <testcase classname="${classname}" name="${name}">${inner ? `\n      ${inner}\n    ` : ''}</testcase>\n`;
  }
  const trimmedTestcases = testcases.trimEnd();

  return (
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuite name="goalrun" tests="${total}" failures="${errors}" skipped="${skipped}" errors="0">`,
      trimmedTestcases || '',
      '</testsuite>',
    ]
      .join('\n')
      .trimEnd() + '\n'
  );
}
