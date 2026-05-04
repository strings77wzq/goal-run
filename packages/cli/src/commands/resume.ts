import { resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import pc from "picocolors";
import { loadConfig } from "../utils/config.js";
import {
  advanceState,
  createCheckpoint,
  isTerminal,
  type RunState,
} from "@goalrun/core";

export async function resumeCommand(
  runId: string,
  opts: { json?: boolean; to?: string },
): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const runDir = resolve(repoRoot, config.runs_dir, runId);
  const statusPath = resolve(runDir, "status.json");

  if (!existsSync(statusPath)) {
    console.error(pc.red(`Run "${runId}" not found at ${statusPath}`));
    process.exit(1);
  }

  let state: RunState;
  try {
    state = JSON.parse(readFileSync(statusPath, "utf-8")) as RunState;
  } catch {
    console.error(pc.red(`Failed to parse status.json for run "${runId}"`));
    process.exit(1);
  }

  if (isTerminal(state.status)) {
    console.log(pc.yellow(`Run "${runId}" is already in terminal state: ${state.status}`));
    console.log(pc.dim("Use 'goalrun report' to view the final status."));
    return;
  }

  // Default transitions based on current state
  const nextStatus = opts.to ?? getDefaultNext(state.status);

  if (!nextStatus) {
    console.error(pc.red(`Cannot determine next status from "${state.status}". Use --to <status>.`));
    console.error(pc.dim(`Valid next states: ${getValidNext(state.status).join(", ")}`));
    process.exit(1);
  }

  const result = advanceState(state, nextStatus);

  if (!result.success) {
    console.error(pc.red(result.error));
    console.error(pc.dim(`Valid next states: ${getValidNext(state.status).join(", ")}`));
    process.exit(1);
  }

  // Create checkpoint
  const { state: updatedState, checkpoint } = createCheckpoint(
    result.state,
    `Advanced to ${nextStatus}`,
  );

  // Save checkpoint
  const cpDir = resolve(runDir, "checkpoints", checkpoint.id);
  mkdirSync(cpDir, { recursive: true });
  writeFileSync(resolve(cpDir, "status.json"), JSON.stringify(checkpoint, null, 2), "utf-8");

  // Update status.json
  writeFileSync(statusPath, JSON.stringify(updatedState, null, 2), "utf-8");

  if (opts.json) {
    console.log(JSON.stringify({ run_id: runId, checkpoint, state: updatedState }, null, 2));
  } else {
    console.log(pc.green(`Run "${runId}" → ${nextStatus}`));
    console.log(pc.dim(`Checkpoint: ${checkpoint.id}`));
    console.log(pc.dim(`Iteration: ${updatedState.iteration}/${updatedState.max_iterations}`));

    if (isTerminal(nextStatus)) {
      console.log(pc.bold(nextStatus === "completed"
        ? pc.green("Run completed!")
        : pc.yellow(`Run ended: ${nextStatus}`)));
    } else {
      printNextAction(nextStatus, state);
    }
  }
}

function getDefaultNext(current: string): string | null {
  const defaults: Record<string, string> = {
    planned: "waiting_for_agent",
    waiting_for_agent: "waiting_for_user",
    waiting_for_user: "verifying",
    verifying: "completed",
    needs_revision: "waiting_for_agent",
    blocked_by_policy: "waiting_for_user",
  };
  return defaults[current] ?? null;
}

function getValidNext(current: string): string[] {
  const transitions: Record<string, string[]> = {
    planned: ["waiting_for_agent", "stopped", "failed"],
    waiting_for_agent: ["waiting_for_user", "stopped", "failed"],
    waiting_for_user: ["verifying", "waiting_for_agent", "stopped", "failed"],
    verifying: ["completed", "needs_revision", "blocked_by_policy", "stopped", "failed"],
    needs_revision: ["waiting_for_agent", "stopped", "failed"],
    blocked_by_policy: ["waiting_for_user", "stopped", "failed"],
  };
  return transitions[current] ?? [];
}

function printNextAction(status: string, state: RunState): void {
  const planPath = resolve(process.cwd(), ".goalrun", "runs", state.run_id, "agent-prompt.md");

  switch (status) {
    case "waiting_for_agent":
      console.log(pc.bold("\nNext:"));
      console.log(pc.dim(`  Share ${planPath} with Claude Code / Codex`));
      console.log(pc.dim("  After agent produces output, run: goalrun resume --to waiting_for_user"));
      break;
    case "waiting_for_user":
      console.log(pc.bold("\nNext:"));
      console.log(pc.dim("  Review the agent's output"));
      console.log(pc.dim("  Paste evidence to .goalrun/runs/<id>/artifacts/"));
      console.log(pc.dim("  Run: goalrun resume --to verifying"));
      break;
    case "verifying":
      console.log(pc.bold("\nNext:"));
      console.log(pc.dim("  Run verification commands and check criteria"));
      console.log(pc.dim("  If all criteria pass: goalrun resume --to completed"));
      console.log(pc.dim("  If revision needed: goalrun resume --to needs_revision"));
      break;
    case "needs_revision":
      console.log(pc.bold("\nNext:"));
      console.log(pc.dim("  Share the updated agent prompt with revisions"));
      console.log(pc.dim("  Run: goalrun resume --to waiting_for_agent"));
      break;
    case "blocked_by_policy":
      console.log(pc.bold("\nNext:"));
      console.log(pc.dim("  Review the blocked policy gate"));
      console.log(pc.dim("  If approved, run: goalrun resume --to waiting_for_user"));
      console.log(pc.dim("  If rejected, run: goalrun resume --to stopped"));
      break;
  }
}
