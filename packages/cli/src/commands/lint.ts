import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig } from '../utils/config.js';
import { formatText, formatJson } from 'goalrun-reporter';
import { runStaticHarness } from 'goalrun-harness';
import { DEFAULT_POLICY, type Diagnostic } from 'goalrun-core';
import fastGlob from 'fast-glob';
const { globSync } = fastGlob;

export async function lintCommand(opts: { json?: boolean }): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const diagnostics: Diagnostic[] = [];

  // Check AGENTS.md exists
  if (!existsSync(resolve(repoRoot, 'AGENTS.md'))) {
    diagnostics.push({
      code: 'LINT_NO_AGENTS',
      severity: 'warning',
      message: 'No AGENTS.md found in repo root',
      hint: "Run 'goalrun init' to scaffold the required files",
    });
  }

  // Validate all skill files
  const skillsDir = resolve(repoRoot, config.skills_dir);
  if (existsSync(skillsDir)) {
    const skillFiles = globSync('*/SKILL.md', { cwd: skillsDir });
    for (const sf of skillFiles) {
      const skillDir = resolve(skillsDir, sf.replace('/SKILL.md', ''));
      const diags = runStaticHarness({ skillDir, policy: DEFAULT_POLICY });
      diagnostics.push(...diags);
    }
  }

  // Validate policy file
  const policyPath = resolve(repoRoot, config.policy_file);
  if (!existsSync(policyPath)) {
    diagnostics.push({
      code: 'LINT_NO_POLICY',
      severity: 'error',
      message: `Policy file not found: ${config.policy_file}`,
    });
  }

  if (opts.json) {
    console.log(formatJson(diagnostics));
  } else {
    console.log(formatText(diagnostics));
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  if (hasErrors) process.exit(1);
}
