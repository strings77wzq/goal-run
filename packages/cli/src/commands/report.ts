import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import pc from "picocolors";
import { loadConfig } from "../utils/config.js";
import { type RunState } from "@goalrun/core";

export async function reportCommand(
  runIdOrLatest: string,
  opts: { json?: boolean },
): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const runsDir = resolve(repoRoot, config.runs_dir);

  if (!existsSync(runsDir)) {
    console.log(pc.yellow("No runs directory found."));
    console.log(pc.dim("Run 'goalrun run <goal.yaml> --supervised' to create a run."));
    return;
  }

  const runs = readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();

  if (runs.length === 0) {
    console.log(pc.yellow("No runs found."));
    return;
  }

  const runId = runIdOrLatest === "latest" ? runs[0]! : runIdOrLatest;
  const runDir = resolve(runsDir, runId);
  const statusPath = resolve(runDir, "status.json");

  if (!existsSync(statusPath)) {
    console.error(pc.red(`Run "${runId}" not found.`));
    process.exit(1);
  }

  const statusRaw = readFileSync(statusPath, "utf-8");
  let state: RunState;
  try {
    state = JSON.parse(statusRaw) as RunState;
  } catch {
    // Fallback to legacy format
    const legacy = JSON.parse(statusRaw) as Record<string, string>;
    if (opts.json) {
      console.log(JSON.stringify({ run_id: runId, status: legacy }, null, 2));
    } else {
      console.log(pc.bold("Run Report (legacy format)"));
      console.log(`ID: ${runId}`);
      console.log(`Goal: ${legacy.goal_id ?? "unknown"}`);
      console.log(`Status: ${legacy.status ?? "unknown"}`);
      console.log(`Started: ${legacy.started_at ?? "unknown"}`);
    }
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify({
      run_id: runId,
      run_dir: runDir,
      state,
      criteria_summary: {
        total: state.criteria.length,
        passed: state.criteria.filter((c) => c.status === "pass").length,
        failed: state.criteria.filter((c) => c.status === "fail").length,
        pending: state.criteria.filter((c) => c.status === "pending").length,
      },
      checkpoints: state.checkpoints.length,
      has_plan: existsSync(resolve(runDir, "plan.md")),
      has_prompt: existsSync(resolve(runDir, "agent-prompt.md")),
    }, null, 2));
  } else {
    console.log(pc.bold("Run Report"));
    console.log(`ID:        ${state.run_id}`);
    console.log(`Goal:      ${state.goal_id}`);
    console.log(`Status:    ${state.status}`);
    console.log(`Iteration: ${state.iteration}/${state.max_iterations}`);
    console.log(`Started:   ${state.started_at}`);
    if (state.completed_at) {
      console.log(`Completed: ${state.completed_at}`);
    }
    if (state.error) {
      console.log(pc.red(`Error:     ${state.error}`));
    }
    console.log("");

    // Criteria
    if (state.criteria.length > 0) {
      console.log(pc.bold("Criteria:"));
      for (const c of state.criteria) {
        const icon = c.status === "pass" ? pc.green("✓") : c.status === "fail" ? pc.red("✗") : pc.dim("○");
        console.log(`  ${icon} ${c.text}`);
      }
      console.log("");
    }

    // Checkpoints
    if (state.checkpoints.length > 0) {
      console.log(pc.bold(`Checkpoints (${state.checkpoints.length}):`));
      for (const cp of state.checkpoints) {
        console.log(`  ${pc.dim(cp.id)} → ${cp.status}${cp.summary ? ` — ${cp.summary}` : ""}`);
      }
      console.log("");
    }

    // Files
    console.log(pc.bold("Artifacts:"));
    const files = ["plan.md", "agent-prompt.md", "policy-gates.json", "verification-checklist.json"];
    for (const f of files) {
      const exists = existsSync(resolve(runDir, f));
      console.log(`  ${exists ? pc.green("✓") : pc.dim("✗")} ${f}`);
    }

    // Check for loop artifacts
    const checkpointsDir = resolve(runDir, "checkpoints");
    if (existsSync(checkpointsDir)) {
      const cpCount = readdirSync(checkpointsDir).length;
      console.log(`  ${pc.green("✓")} checkpoints/ (${cpCount} items)`);
    }
    const artifactsDir = resolve(runDir, "artifacts");
    if (existsSync(artifactsDir)) {
      const aCount = readdirSync(artifactsDir).length;
      console.log(`  ${pc.cyan(aCount > 0 ? "✓" : "○")} artifacts/ (${aCount} items)`);
    }
  }
}
