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
  } catch (err) {
    console.error(`Warning: failed to parse ${configPath}, using defaults. Error: ${String(err)}`);
    return DEFAULT_CONFIG;
  }
}
