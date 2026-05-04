import { resolve } from "node:path";
import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import pc from "picocolors";
import { loadConfig } from "../utils/config.js";
import { runGoalHarness, runPolicyHarness, generatePlanReport } from "@goalrun/harness";
import { DEFAULT_POLICY, parsePolicyConfigSafe, generateHandoff, TARGETS } from "@goalrun/core";
import type { HandoffTarget } from "@goalrun/core";

export async function handoffCommand(
  goalPath: string,
  opts: { target: string; output?: string; json?: boolean },
): Promise<void> {
  const target = opts.target as HandoffTarget;
  if (!TARGETS.includes(target)) {
    console.error(pc.red(`Unknown target "${opts.target}". Supported: ${TARGETS.join(", ")}`));
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const fullGoalPath = resolve(repoRoot, goalPath);

  if (!existsSync(fullGoalPath)) {
    console.error(pc.red(`Goal file not found: ${goalPath}`));
    process.exit(1);
  }

  const skillsDir = resolve(repoRoot, config.skills_dir);
  const availableSkills = existsSync(skillsDir)
    ? readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];

  const policyPath = resolve(repoRoot, config.policy_file);
  let policy = DEFAULT_POLICY;
  if (existsSync(policyPath)) {
    const raw = readFileSync(policyPath, "utf-8");
    const parsed = parsePolicyConfigSafe(raw, policyPath);
    if (parsed.success) policy = parsed.config;
  }

  const goalResult = runGoalHarness({ goalYamlPath: fullGoalPath, policy, availableSkills });
  if (!goalResult.success || !goalResult.spec) {
    console.error(pc.red("Goal validation failed."));
    process.exit(1);
  }

  const spec = goalResult.spec;
  const policyResult = runPolicyHarness({ policyYamlPath: policyPath, goalSpec: spec, goalYamlPath: fullGoalPath });

  const planReport = generatePlanReport(
    spec.id, spec.title, spec.skills,
    spec.policy.require_approval_for, spec.verification.commands,
    [], [...goalResult.diagnostics, ...policyResult.diagnostics],
  );

  const handoff = generateHandoff(
    {
      goalId: spec.id,
      goalTitle: spec.title,
      selectedSkills: spec.skills,
      policyGates: spec.policy.require_approval_for,
      verificationChecklist: spec.verification.commands,
      riskSummary: [],
      diagnostics: [...goalResult.diagnostics, ...policyResult.diagnostics].map((d) => ({
        code: d.code, severity: d.severity, message: d.message, hint: d.hint,
      })),
      agentPrompt: planReport.agentPrompt,
    },
    target,
  );

  if (opts.output) {
    const outPath = resolve(repoRoot, opts.output);
    mkdirSync(resolve(outPath, ".."), { recursive: true });
    writeFileSync(outPath, handoff, "utf-8");
    console.log(pc.green(`Handoff written to: ${outPath}`));
  }

  if (opts.json) {
    console.log(JSON.stringify({ target, handoff }, null, 2));
  } else {
    console.log(handoff);
  }
}
