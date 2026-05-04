import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

export interface GoalrunConfig {
  version: number;
  skills_dir: string;
  goals_dir: string;
  policy_file: string;
  selection_tests: string;
  runs_dir: string;
  lockfile: string;
}

const DEFAULT_CONFIG: GoalrunConfig = {
  version: 1,
  skills_dir: '.agent/skills',
  goals_dir: '.goalrun/goals',
  policy_file: '.goalrun/policy.yaml',
  selection_tests: '.goalrun/tests/selection.yaml',
  runs_dir: '.goalrun/runs',
  lockfile: 'goalrun.lock',
};

export function loadConfig(repoRoot: string): GoalrunConfig {
  const configPath = resolve(repoRoot, '.goalrun/config.yaml');
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }
  const raw = readFileSync(configPath, 'utf-8');
  try {
    const parsed = parseYaml(raw);
    return { ...DEFAULT_CONFIG, ...(parsed as Partial<GoalrunConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function getTemplatesDir(): string {
  // In development, templates are at the monorepo root
  const cwd = process.cwd();
  // Check for monorepo layout
  const monorepoRoot = resolve(cwd, '..', '..');
  const templatesPath = resolve(monorepoRoot, 'templates');
  if (existsSync(templatesPath)) {
    return templatesPath;
  }
  // Fallback: templates next to the CLI package
  const pkgRoot = resolve(cwd, '..');
  const altPath = resolve(pkgRoot, 'templates');
  if (existsSync(altPath)) {
    return altPath;
  }
  return templatesPath;
}

export function getBuiltinSkillsDir(): string {
  const cwd = process.cwd();
  const monorepoRoot = resolve(cwd, '..', '..');
  const skillsPath = resolve(monorepoRoot, 'skills');
  if (existsSync(skillsPath)) {
    return skillsPath;
  }
  return resolve(cwd, '..', 'skills');
}
