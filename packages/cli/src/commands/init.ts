import { resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import pc from "picocolors";
import { getRepoInitFiles } from "../utils/templates.js";

export interface InitOptions {
  force?: boolean;
  dryRun?: boolean;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const repoRoot = process.cwd();
  const files = getRepoInitFiles();

  const created: string[] = [];
  const skipped: string[] = [];

  for (const { dest, content } of files) {
    const fullPath = resolve(repoRoot, dest);

    if (existsSync(fullPath) && !opts.force) {
      skipped.push(dest);
      continue;
    }

    if (opts.dryRun) {
      created.push(dest);
      continue;
    }

    mkdirSync(resolve(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
    created.push(dest);
  }

  if (opts.dryRun) {
    console.log(pc.cyan("[DRY RUN] Would create:"));
    for (const f of created) {
      console.log(`  ${pc.green("+")} ${f}`);
    }
    if (skipped.length > 0) {
      console.log(pc.dim("\nWould skip (already exist):"));
      for (const f of skipped) {
        console.log(`  ${pc.yellow("~")} ${f}`);
      }
    }
  } else {
    console.log(pc.green("GoalRun initialized!"));
    for (const f of created) {
      console.log(`  ${pc.green("+")} ${f}`);
    }
    if (skipped.length > 0) {
      console.log(pc.dim("\nSkipped (already exist, use --force to overwrite):"));
      for (const f of skipped) {
        console.log(`  ${pc.yellow("~")} ${f}`);
      }
    }
  }

  console.log(pc.dim("\nNext steps:"));
  console.log(pc.dim("  goalrun skill install tdd-change code-review implementation-strategy"));
  console.log(pc.dim("  goalrun plan .goalrun/goals/example-fix-bug.yaml"));
}
