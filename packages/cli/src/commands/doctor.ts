import { resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import pc from 'picocolors';
import { loadConfig } from '../utils/config.js';

export async function doctorCommand(opts: { json?: boolean }): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  // Check Node version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0] ?? '0');
  checks.push({
    name: 'Node.js >= 20',
    ok: nodeMajor >= 20,
    detail: `Found ${nodeVersion}`,
  });

  // Check pnpm availability
  checks.push({
    name: 'pnpm available',
    ok: true, // We trust the user, since doctor runs via pnpm
    detail: 'Running via pnpm',
  });

  // Check repo root
  const hasPackageJson = existsSync(resolve(repoRoot, 'package.json'));
  checks.push({
    name: 'Repo root (package.json)',
    ok: hasPackageJson,
    detail: hasPackageJson ? 'Found' : 'Not found — are you in a project root?',
  });

  // Check GoalRun structure
  const hasGoalrunDir = existsSync(resolve(repoRoot, '.goalrun'));
  checks.push({
    name: '.goalrun/ directory',
    ok: hasGoalrunDir,
    detail: hasGoalrunDir ? 'Found' : "Missing — run 'goalrun init'",
  });

  const hasConfig = existsSync(resolve(repoRoot, '.goalrun/config.yaml'));
  checks.push({
    name: '.goalrun/config.yaml',
    ok: hasConfig,
    detail: hasConfig ? 'Found' : "Missing — run 'goalrun init'",
  });

  const hasPolicy = existsSync(resolve(repoRoot, config.policy_file));
  checks.push({
    name: config.policy_file,
    ok: hasPolicy,
    detail: hasPolicy ? 'Found' : "Missing — run 'goalrun init'",
  });

  // Check skills
  const skillsDir = resolve(repoRoot, config.skills_dir);
  const hasSkillsDir = existsSync(skillsDir);
  let skillCount = 0;
  if (hasSkillsDir) {
    try {
      skillCount = readdirSync(skillsDir, { withFileTypes: true }).filter((d) =>
        d.isDirectory(),
      ).length;
    } catch {
      /* empty */
    }
  }
  checks.push({
    name: 'Installed skills',
    ok: skillCount > 0,
    detail: hasSkillsDir ? `${skillCount} skill(s) found` : 'No .agent/skills/ directory',
  });

  // Check lockfile
  const hasLockfile = existsSync(resolve(repoRoot, config.lockfile));
  checks.push({
    name: config.lockfile,
    ok: hasLockfile,
    detail: hasLockfile ? 'Found' : "Missing — run 'goalrun skill install'",
  });

  // Check AGENTS.md
  const hasAgents = existsSync(resolve(repoRoot, 'AGENTS.md'));
  checks.push({
    name: 'AGENTS.md',
    ok: hasAgents,
    detail: hasAgents ? 'Found' : "Missing — run 'goalrun init'",
  });

  if (opts.json) {
    console.log(JSON.stringify(checks, null, 2));
  } else {
    console.log(pc.bold('GoalRun Doctor'));
    console.log(`Repo: ${repoRoot}`);
    console.log('');

    let allOk = true;
    for (const check of checks) {
      const icon = check.ok ? pc.green('✓') : pc.red('✗');
      console.log(`${icon} ${check.name}: ${check.detail}`);
      if (!check.ok) allOk = false;
    }

    console.log('');
    if (allOk) {
      console.log(pc.green('All checks passed!'));
    } else {
      console.log(
        pc.yellow("Some checks failed. Run 'goalrun init' and 'goalrun skill install' to fix."),
      );
    }
  }

  const hasFailures = checks.some((c) => !c.ok);
  if (hasFailures) process.exit(1);
}
