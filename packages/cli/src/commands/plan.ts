import { resolve } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import pc from 'picocolors';
import { loadConfig } from '../utils/config.js';
import { runGoalHarness, runPolicyHarness, generatePlanReport, deriveRiskSummary } from 'goalrun-harness';
import { formatText, formatJson } from 'goalrun-reporter';
import { DEFAULT_POLICY, parsePolicyConfigSafe, resolveSafe } from 'goalrun-core';

export async function planCommand(goalPath: string, opts: { json?: boolean }): Promise<void> {
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

  // Run goal harness
  const goalResult = runGoalHarness({
    goalYamlPath: fullGoalPath,
    policy,
    availableSkills,
  });

  if (!goalResult.success || !goalResult.spec) {
    if (opts.json) {
      console.log(formatJson(goalResult.diagnostics));
    } else {
      console.log(pc.red('Goal validation failed:'));
      console.log(formatText(goalResult.diagnostics));
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
  const riskSummary = deriveRiskSummary(
    spec.budget,
    spec.policy.require_approval_for,
    [...goalResult.diagnostics, ...policyResult.diagnostics],
  );

  const planReport = generatePlanReport(
    spec.id,
    spec.title,
    spec.skills,
    spec.policy.require_approval_for,
    spec.verification.commands,
    riskSummary,
    [...goalResult.diagnostics, ...policyResult.diagnostics],
  );

  if (opts.json) {
    console.log(JSON.stringify(planReport, null, 2));
  } else {
    console.log(pc.bold(pc.green('Execution Plan Generated')));
    console.log(`Goal: ${spec.title} (${spec.id})`);
    console.log(`Skills: ${spec.skills.join(', ')}`);
    console.log(
      `Budget: ${spec.budget.max_iterations} iterations, ${spec.budget.max_changed_files} files, ${spec.budget.max_runtime_minutes} min`,
    );
    console.log('');
    console.log(pc.bold('Risk Summary:'));
    for (const r of riskSummary) {
      console.log(`  ${pc.yellow('!')} ${r}`);
    }
    console.log('');
    console.log(pc.bold('Agent Prompt (ready to share with Claude/Codex):'));
    console.log(pc.dim('---'));
    console.log(planReport.agentPrompt);
    console.log(pc.dim('---'));
  }
}
