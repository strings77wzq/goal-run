import { resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { loadConfig } from '../utils/config.js';
import {
  runGoalHarness,
  runPolicyHarness,
  generatePlanReport,
  deriveRiskSummary,
} from 'goalrun-harness';
import {
  DEFAULT_POLICY,
  parsePolicyConfigSafe,
  createRunState,
  createCheckpoint,
  resolveSafe,
  isGitRepo,
  createWorktree,
} from 'goalrun-core';

export async function runCommand(
  goalPath: string,
  opts: { dryRun?: boolean; json?: boolean; loop?: boolean; isolated?: boolean },
): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const fullGoalPath = resolveSafe(repoRoot, goalPath);

  // Load available skills
  const skillsDir = resolve(repoRoot, config.skills_dir);
  const availableSkills = existsSync(skillsDir)
    ? readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  // Load policy
  const policyPath = resolve(repoRoot, config.policy_file);
  let policy = DEFAULT_POLICY;
  if (existsSync(policyPath)) {
    const policyContent = readFileSync(policyPath, 'utf-8');
    const parsed = parsePolicyConfigSafe(policyContent, policyPath);
    if (parsed.success) policy = parsed.config;
  }

  // Validate goal
  const goalResult = runGoalHarness({
    goalYamlPath: fullGoalPath,
    policy,
    availableSkills,
  });

  if (!goalResult.success || !goalResult.spec) {
    console.error(pc.red('Goal validation failed. Fix errors before running.'));
    for (const d of goalResult.diagnostics.filter((d) => d.severity === 'error')) {
      console.error(`  ${d.code}: ${d.message}`);
    }
    process.exit(1);
  }

  const spec = goalResult.spec;

  // Run policy harness
  const policyResult = runPolicyHarness({
    policyYamlPath: policyPath,
    goalSpec: spec,
    goalYamlPath: fullGoalPath,
  });

  // Generate plan report
  const riskSummary = deriveRiskSummary(spec.budget, spec.policy.require_approval_for, [
    ...goalResult.diagnostics,
    ...policyResult.diagnostics,
  ]);

  const planReport = generatePlanReport(
    spec.id,
    spec.title,
    spec.skills,
    spec.policy.require_approval_for,
    spec.verification.commands,
    riskSummary,
    [...goalResult.diagnostics, ...policyResult.diagnostics],
  );

  // Create run directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = resolve(repoRoot, config.runs_dir, timestamp);

  // Create RunState first
  const runState = createRunState(
    timestamp,
    spec.id,
    spec.skills,
    spec.criteria,
    spec.budget,
    spec.policy.require_approval_for,
  );

  // Worktree isolation path (actual creation happens after dry-run handling)
  let worktreePath: string | undefined;
  if (opts.isolated) {
    if (!isGitRepo(repoRoot)) {
      console.error(pc.red('Error: --isolated requires a git repository.'));
      process.exit(1);
    }
    worktreePath = `.goalrun/runs/${timestamp}/worktree`;
  }

  if (opts.dryRun) {
    console.log(pc.cyan(`[DRY RUN] Would create run in: ${runDir}`));
    console.log(pc.cyan('Would create: plan.md, agent-prompt.md, status.json'));
    if (opts.loop) {
      console.log(pc.cyan('Would create: checkpoints/, artifacts/, verification/'));
    }
    if (opts.isolated) {
      console.log(pc.cyan(`Would create worktree at: ${worktreePath}`));
    }
  } else {
    if (opts.isolated && worktreePath) {
      const wtResult = createWorktree(repoRoot, worktreePath);
      if (!wtResult.success) {
        console.error(pc.red(`Error creating worktree: ${wtResult.error}`));
        process.exit(1);
      }
      runState.isolated = true;
      runState.worktree_path = worktreePath;
      runState.branch_name = wtResult.branch;
      console.log(pc.cyan(`Worktree created at: ${worktreePath}`));
    }

    mkdirSync(runDir, { recursive: true });

    // Core files
    writeFileSync(resolve(runDir, 'plan.md'), planReport.agentPrompt, 'utf-8');
    writeFileSync(resolve(runDir, 'agent-prompt.md'), planReport.agentPrompt, 'utf-8');
    writeFileSync(
      resolve(runDir, 'policy-gates.json'),
      JSON.stringify(spec.policy.require_approval_for, null, 2),
      'utf-8',
    );
    writeFileSync(
      resolve(runDir, 'verification-checklist.json'),
      JSON.stringify(spec.verification.commands, null, 2),
      'utf-8',
    );

    if (opts.loop) {
      // Loop mode: create checkpoint + artifact directories
      mkdirSync(resolve(runDir, 'checkpoints'), { recursive: true });
      mkdirSync(resolve(runDir, 'artifacts'), { recursive: true });
      mkdirSync(resolve(runDir, 'verification'), { recursive: true });

      // Create initial checkpoint
      const { checkpoint } = createCheckpoint(runState, 'Initial run created');
      const cpDir = resolve(runDir, 'checkpoints', checkpoint.id);
      mkdirSync(cpDir, { recursive: true });
      writeFileSync(resolve(cpDir, 'status.json'), JSON.stringify(checkpoint, null, 2), 'utf-8');

      // Write full run state
      writeFileSync(
        resolve(runDir, 'status.json'),
        JSON.stringify({ ...runState, checkpoints: [checkpoint] }, null, 2),
        'utf-8',
      );
    } else {
      // Non-loop mode: still write full RunState schema so report/audit/compare work
      writeFileSync(
        resolve(runDir, 'status.json'),
        JSON.stringify({ ...runState, checkpoints: [] }, null, 2),
        'utf-8',
      );
    }

    console.log(pc.green(`Run created in: ${runDir}`));
    if (opts.loop) {
      console.log(pc.cyan('Loop mode enabled. Use these commands to manage the run:'));
      console.log(pc.dim(`  goalrun status ${timestamp}`));
      console.log(pc.dim(`  goalrun advance ${timestamp}    # semi-autonomous advance`));
      console.log(pc.dim(`  goalrun resume ${timestamp} --to <status>  # manual step`));
      console.log(pc.dim(`  goalrun stop ${timestamp}`));
      console.log(pc.dim(`  goalrun report ${timestamp}`));
      console.log(pc.dim(`  goalrun rollback ${timestamp}  # discard changes`));
    }
  }

  console.log('');
  console.log(pc.bold('Next step:'));
  const promptFile = resolve(runDir, 'agent-prompt.md');
  console.log(pc.dim(`  Share ${promptFile} with Claude Code or Codex.`));
  if (worktreePath && !opts.dryRun) {
    console.log(pc.yellow(`  Agent should work in: ${resolve(repoRoot, worktreePath)}`));
  }

  if (opts.json) {
    console.log(
      JSON.stringify({ run_dir: runDir, plan: planReport, run_state: runState }, null, 2),
    );
  }
}
