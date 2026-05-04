import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import pc from "picocolors";
import { loadConfig } from "../utils/config.js";
import {
  runStaticHarness,
  runGoalHarness,
  runPolicyHarness,
  summarizeDiagnostics,
} from "@goalrun/harness";
import { DEFAULT_POLICY, parsePolicyConfigSafe } from "@goalrun/core";
import type { Diagnostic } from "@goalrun/core";
import { formatText } from "@goalrun/reporter";
import { globSync } from "fast-glob";

export async function verifyCommand(
  goalPath: string,
  opts: { json?: boolean },
): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const fullGoalPath = resolve(repoRoot, goalPath);
  const allDiagnostics: Diagnostic[] = [];

  // Load policy
  const policyPath = resolve(repoRoot, config.policy_file);
  let policy = DEFAULT_POLICY;
  if (existsSync(policyPath)) {
    const policyContent = readFileSync(policyPath, "utf-8");
    const parsed = parsePolicyConfigSafe(policyContent, policyPath);
    if (parsed.success) policy = parsed.config;
  }

  // Load available skills
  const skillsDir = resolve(repoRoot, config.skills_dir);
  const availableSkills = existsSync(skillsDir)
    ? readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  // 1. Static harness: validate all installed skills
  if (existsSync(skillsDir)) {
    const skillFiles = globSync("*/SKILL.md", { cwd: skillsDir });
    for (const sf of skillFiles) {
      const skillDir = resolve(skillsDir, sf.replace("/SKILL.md", ""));
      const diags = runStaticHarness({ skillDir, policy });
      allDiagnostics.push(...diags);
    }
  }

  // 2. Goal harness
  if (existsSync(fullGoalPath)) {
    const goalResult = runGoalHarness({
      goalYamlPath: fullGoalPath,
      policy,
      availableSkills,
    });
    allDiagnostics.push(...goalResult.diagnostics);

    // 3. Policy harness (with goal context)
    if (existsSync(policyPath)) {
      const policyResult = runPolicyHarness({
        policyYamlPath: policyPath,
        goalSpec: goalResult.spec,
        goalYamlPath: fullGoalPath,
        skillDirs: availableSkills.map((s) => resolve(skillsDir, s)),
      });
      allDiagnostics.push(...policyResult.diagnostics);
    }
  }

  const summary = summarizeDiagnostics(allDiagnostics);
  const errors = allDiagnostics.filter((d) => d.severity === "error");

  if (opts.json) {
    const report = {
      passed: errors.length === 0,
      summary,
      diagnostics: allDiagnostics,
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatText(allDiagnostics));
    if (errors.length === 0) {
      console.log(pc.green("Verification passed."));
    } else {
      console.log(pc.red(`Verification failed with ${errors.length} error(s).`));
    }
  }

  if (errors.length > 0) process.exit(1);
}
