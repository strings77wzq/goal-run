import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import pc from "picocolors";
import { loadConfig } from "../utils/config.js";
import { isTerminal, type RunState, type RunStatus } from "@goalrun/core";

const STATUS_ICONS: Record<RunStatus, string> = {
  planned: pc.blue("◉"),
  waiting_for_agent: pc.cyan("◔"),
  waiting_for_user: pc.magenta("◑"),
  verifying: pc.yellow("◕"),
  needs_revision: pc.yellow("↻"),
  blocked_by_policy: pc.red("⊗"),
  completed: pc.green("✓"),
  failed: pc.red("✗"),
  stopped: pc.yellow("⊘"),
};

export async function statusCommand(
  runIdOrAll: string,
  opts: { json?: boolean },
): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const runsDir = resolve(repoRoot, config.runs_dir);

  if (!existsSync(runsDir)) {
    console.log(pc.yellow("No runs directory found."));
    return;
  }

  if (runIdOrAll === "all" || runIdOrAll === "--all") {
    // Show all runs
    const runs = getRuns(runsDir);
    if (runs.length === 0) {
      console.log(pc.yellow("No runs found."));
      return;
    }

    if (opts.json) {
      const summaries = runs.map((r) => ({
        run_id: r.id,
        goal_id: r.state?.goal_id,
        status: r.state?.status ?? "unknown",
        iteration: r.state?.iteration,
        started_at: r.state?.started_at,
      }));
      console.log(JSON.stringify(summaries, null, 2));
    } else {
      for (const run of runs) {
        const icon = run.state ? STATUS_ICONS[run.state.status] ?? "?" : "?";
        console.log(`${icon} ${run.id}  ${run.state?.goal_id ?? "?"}  ${run.state?.status ?? "no status.json"}`);
      }
    }
    return;
  }

  // Show specific run
  const runDir = resolve(runsDir, runIdOrAll);
  const statusPath = resolve(runDir, "status.json");

  if (!existsSync(statusPath)) {
    console.error(pc.red(`Run "${runIdOrAll}" not found.`));
    process.exit(1);
  }

  let state: RunState;
  try {
    state = JSON.parse(readFileSync(statusPath, "utf-8")) as RunState;
  } catch {
    console.error(pc.red(`Failed to parse status.json for "${runIdOrAll}"`));
    process.exit(1);
  }

  if (opts.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    const icon = STATUS_ICONS[state.status] ?? "?";
    console.log(`${icon} ${pc.bold(`Run: ${state.run_id}`)}`);
    console.log(`  Goal:      ${state.goal_id}`);
    console.log(`  Status:    ${state.status}`);
    console.log(`  Iteration: ${state.iteration}/${state.max_iterations}`);
    console.log(`  Started:   ${state.started_at}`);
    if (state.completed_at) {
      console.log(`  Completed: ${state.completed_at}`);
    }

    // Criteria status
    if (state.criteria.length > 0) {
      console.log(`  Criteria:`);
      for (const c of state.criteria) {
        const ci = c.status === "pass" ? pc.green("✓") : c.status === "fail" ? pc.red("✗") : pc.dim("○");
        console.log(`    ${ci} ${c.text}`);
      }
    }

    // Skills
    if (state.skills.length > 0) {
      console.log(`  Skills: ${state.skills.join(", ")}`);
    }

    // Checkpoints
    if (state.checkpoints.length > 0) {
      console.log(`  Checkpoints: ${state.checkpoints.length}`);
      const last = state.checkpoints[state.checkpoints.length - 1];
      if (last) {
        console.log(`    Last: ${last.id} (${last.status})`);
        if (last.summary) console.log(`    ${last.summary}`);
      }
    }

    // Policy gates
    if (state.policy_gates.length > 0) {
      console.log(`  Policy Gates:`);
      for (const g of state.policy_gates) {
        console.log(`    ⚑ ${g}`);
      }
    }

    if (isTerminal(state.status)) {
      console.log("");
      console.log(pc.dim("Run has reached a terminal state."));
    }
  }
}

function getRuns(runsDir: string): { id: string; state: RunState | null }[] {
  const entries = readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();

  return entries.map((id) => {
    const statusPath = resolve(runsDir, id, "status.json");
    try {
      return { id, state: JSON.parse(readFileSync(statusPath, "utf-8")) as RunState };
    } catch {
      return { id, state: null };
    }
  });
}
