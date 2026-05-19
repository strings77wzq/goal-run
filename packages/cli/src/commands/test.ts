import { resolve } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import pc from 'picocolors';
import { loadConfig } from '../utils/config.js';
import { parseSelectionTests, createError, createInfo, type Diagnostic } from 'goalrun-core';
import { formatDiagnostics } from 'goalrun-reporter';
import type { FormatType } from 'goalrun-reporter';
import { runSelectionHarness } from 'goalrun-harness';

export async function testCommand(opts: { json?: boolean; format?: string }): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const testsPath = resolve(repoRoot, config.selection_tests);

  if (!existsSync(testsPath)) {
    console.error(pc.red(`Selection tests file not found: ${config.selection_tests}`));
    console.error(pc.dim("Run 'goalrun init' to scaffold selection tests."));
    process.exit(1);
  }

  const content = readFileSync(testsPath, 'utf-8');
  const parsed = parseSelectionTests(content, testsPath);

  if (!parsed.success) {
    console.error(pc.red('Failed to parse selection tests:'));
    for (const d of parsed.diagnostics) {
      console.error(`  ${d.message}`);
    }
    process.exit(1);
  }

  const availableSkills = getInstalledSkills(repoRoot, config);

  const result = runSelectionHarness(parsed.tests, availableSkills);

  if (opts.format) {
    const diags: Diagnostic[] = result.results.map((r) =>
      r.passed
        ? createInfo('SELECTION_PASS', r.test.description)
        : createError('SELECTION_MISMATCH', r.test.description, {
            hint: `Expected: ${r.expected}, Got: ${r.matched}`,
          }),
    );
    const format = opts.format as FormatType;
    console.log(formatDiagnostics(diags, format));
  } else if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(pc.bold('Selection Test Results'));
    console.log(
      `Total: ${result.summary.total}, Passed: ${pc.green(String(result.summary.passed))}, Failed: ${pc.red(String(result.summary.failed))}`,
    );
    console.log('');

    for (const r of result.results) {
      const icon = r.passed ? pc.green('✓') : pc.red('✗');
      console.log(`${icon} ${r.test.description}`);
      if (!r.passed) {
        console.log(`   Expected: ${r.expected}, Got: ${r.matched}`);
      }
    }
  }

  if (result.summary.failed > 0) process.exit(1);
}

function getInstalledSkills(repoRoot: string, config: ReturnType<typeof loadConfig>): string[] {
  const skillsDir = resolve(repoRoot, config.skills_dir);
  if (!existsSync(skillsDir)) return [];

  try {
    return readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}
