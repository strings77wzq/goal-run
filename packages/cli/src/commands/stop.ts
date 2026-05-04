import { resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import pc from "picocolors";
import { loadConfig } from "../utils/config.js";
import { advanceState, createCheckpoint, isTerminal, type RunState } from "@strings77wzq/goalrun-core";

export async function stopCommand(
  runId: string,
  opts: { json?: boolean },
): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const runDir = resolve(repoRoot, config.runs_dir, runId);
  const statusPath = resolve(runDir, "status.json");

  if (!existsSync(statusPath)) {
    console.error(pc.red(`Run "${runId}" not found.`));
    process.exit(1);
  }

  let state: RunState;
  try {
    state = JSON.parse(readFileSync(statusPath, "utf-8")) as RunState;
  } catch {
    console.error(pc.red(`Failed to parse status.json for "${runId}"`));
    process.exit(1);
  }

  if (isTerminal(state.status)) {
    console.log(pc.yellow(`Run "${runId}" is already in terminal state: ${state.status}`));
    return;
  }

  const result = advanceState(state, "stopped");

  if (!result.success) {
    console.error(pc.red(result.error));
    process.exit(1);
  }

  const { state: updatedState, checkpoint } = createCheckpoint(
    result.state,
    "Run stopped by user",
  );

  // Save checkpoint
  const cpDir = resolve(runDir, "checkpoints", checkpoint.id);
  mkdirSync(cpDir, { recursive: true });
  writeFileSync(resolve(cpDir, "status.json"), JSON.stringify(checkpoint, null, 2), "utf-8");

  // Update status.json
  writeFileSync(statusPath, JSON.stringify(updatedState, null, 2), "utf-8");

  if (opts.json) {
    console.log(JSON.stringify({ run_id: runId, status: "stopped", checkpoint }, null, 2));
  } else {
    console.log(pc.yellow(`Run "${runId}" stopped.`));
    console.log(pc.dim(`Checkpoint: ${checkpoint.id}`));
    console.log(pc.dim("Use 'goalrun resume' to continue, or 'goalrun report' to view."));
  }
}
