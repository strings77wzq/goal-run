#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { initCommand } from "./commands/init.js";
import { skillInstallCommand } from "./commands/skill-install.js";
import { lintCommand } from "./commands/lint.js";
import { testCommand } from "./commands/test.js";
import { planCommand } from "./commands/plan.js";
import { verifyCommand } from "./commands/verify.js";
import { runCommand } from "./commands/run.js";
import { resumeCommand } from "./commands/resume.js";
import { statusCommand } from "./commands/status.js";
import { stopCommand } from "./commands/stop.js";
import { doctorCommand } from "./commands/doctor.js";
import { reportCommand } from "./commands/report.js";

const program = new Command();

program
  .name("goalrun")
  .description("Goal-driven agent skills for software engineering")
  .version("0.2.0");

program
  .command("init")
  .description("Initialize GoalRun scaffold in the current directory")
  .option("--force", "Overwrite existing files")
  .option("--dry-run", "Show what would be created without writing")
  .action(async (opts) => {
    await initCommand({ force: opts.force, dryRun: opts.dryRun });
  });

program
  .command("skill")
  .description("Manage installed skills");

program
  .command("skill install <skills...>")
  .description("Install built-in skills")
  .option("--force", "Overwrite existing modified skills")
  .option("--dry-run", "Show what would be installed")
  .action(async (skills: string[], opts: { force?: boolean; dryRun?: boolean }) => {
    await skillInstallCommand(skills, { force: opts.force, dryRun: opts.dryRun });
  });

program
  .command("lint")
  .description("Validate all GoalRun files")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    await lintCommand({ json: opts.json });
  });

program
  .command("test")
  .description("Run skill selection tests")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    await testCommand({ json: opts.json });
  });

program
  .command("plan <goal>")
  .description("Generate an execution plan from a goal spec")
  .option("--json", "Output as JSON")
  .action(async (goal: string, opts) => {
    await planCommand(goal, { json: opts.json });
  });

program
  .command("verify <goal>")
  .description("Validate a goal spec against all harnesses")
  .option("--json", "Output as JSON")
  .action(async (goal: string, opts) => {
    await verifyCommand(goal, { json: opts.json });
  });

program
  .command("run <goal>")
  .description("Create a supervised run scaffold (does not execute code)")
  .option("--supervised", "Run in supervised mode (required)")
  .option("--loop", "Enable checkpointed loop mode with resume support")
  .option("--dry-run", "Show what would be created")
  .option("--json", "Output as JSON")
  .action(async (goal: string, opts) => {
    if (!opts.supervised) {
      console.error(pc.red("Error: --supervised flag is required for 'run' command."));
      console.error(pc.dim("GoalRun does not execute code. Use --supervised to create a run scaffold."));
      process.exit(1);
    }
    await runCommand(goal, { dryRun: opts.dryRun, json: opts.json, loop: opts.loop });
  });

program
  .command("resume <run-id>")
  .description("Advance a supervised loop run to the next state")
  .option("--to <status>", "Target status to advance to")
  .option("--json", "Output as JSON")
  .action(async (runId: string, opts) => {
    await resumeCommand(runId, { json: opts.json, to: opts.to });
  });

program
  .command("status [run-id]")
  .description("Show run status (run-id or 'all' for all runs)")
  .option("--json", "Output as JSON")
  .action(async (runId: string | undefined, opts) => {
    await statusCommand(runId ?? "all", { json: opts.json });
  });

program
  .command("stop <run-id>")
  .description("Stop a supervised loop run")
  .option("--json", "Output as JSON")
  .action(async (runId: string, opts) => {
    await stopCommand(runId, { json: opts.json });
  });

program
  .command("doctor")
  .description("Check GoalRun installation health")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    await doctorCommand({ json: opts.json });
  });

program
  .command("report [run-id]")
  .description("Show run report (defaults to latest run)")
  .option("--json", "Output as JSON")
  .action(async (runId: string | undefined, opts) => {
    await reportCommand(runId ?? "latest", { json: opts.json });
  });

program.parse();
