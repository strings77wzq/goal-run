import { resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import pc from "picocolors";
import { loadConfig } from "../utils/config.js";
import { getBuiltinSkillContent, getBuiltinSkillNames } from "../utils/templates.js";
import {
  type Lockfile,
  createLockfile,
  addSkillToLockfile,
  computeSkillHash,
} from "goalrun-core";

const SAFE_NAME_RE = /^[a-zA-Z0-9_-]+$/;

export async function skillInstallCommand(
  skills: string[],
  opts: { force?: boolean; dryRun?: boolean },
): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const knownSkills = getBuiltinSkillNames();

  const installed: string[] = [];
  const skipped: string[] = [];
  const unknown: string[] = [];

  for (const skillName of skills) {
    if (!SAFE_NAME_RE.test(skillName)) {
      unknown.push(`${skillName} (invalid name — use only a-z, A-Z, 0-9, hyphens, underscores)`);
      continue;
    }

    if (!knownSkills.includes(skillName)) {
      unknown.push(skillName);
      continue;
    }

    const content = getBuiltinSkillContent(skillName);
    if (!content) {
      unknown.push(skillName);
      continue;
    }

    const destDir = resolve(repoRoot, config.skills_dir, skillName);
    const destPath = resolve(destDir, "SKILL.md");

    if (existsSync(destPath) && !opts.force) {
      const existing = readFileSync(destPath, "utf-8");
      if (existing === content) {
        skipped.push(`${skillName} (already installed, identical)`);
        continue;
      }
      skipped.push(`${skillName} (already exists, use --force to overwrite)`);
      continue;
    }

    if (opts.dryRun) {
      installed.push(skillName);
      continue;
    }

    mkdirSync(destDir, { recursive: true });
    writeFileSync(destPath, content, "utf-8");
    installed.push(skillName);
  }

  // Update lockfile
  if (!opts.dryRun && installed.length > 0) {
    updateLockfile(repoRoot, config.lockfile, installed);
  }

  // Report
  if (installed.length > 0) {
    console.log(pc.green(`Installed ${installed.length} skill(s):`));
    for (const s of installed) {
      console.log(`  ${pc.green("+")} ${s}`);
    }
  }
  if (skipped.length > 0) {
    for (const s of skipped) {
      console.log(`  ${pc.yellow("~")} ${s}`);
    }
  }
  if (unknown.length > 0) {
    console.log(pc.red(`Unknown skill(s): ${unknown.join(", ")}`));
    console.log(pc.dim(`Available: ${knownSkills.join(", ")}`));
  }
}

function updateLockfile(
  repoRoot: string,
  lockfilePath: string,
  installed: string[],
): void {
  const fullPath = resolve(repoRoot, lockfilePath);
  let lockfile: Lockfile;

  if (existsSync(fullPath)) {
    const raw = readFileSync(fullPath, "utf-8");
    try {
      lockfile = JSON.parse(raw) as Lockfile;
    } catch {
      lockfile = createLockfile();
    }
  } else {
    lockfile = createLockfile();
  }

  const config = loadConfig(repoRoot);
  const skillsDir = resolve(repoRoot, config.skills_dir);

  for (const skillName of installed) {
    const skillMdPath = resolve(skillsDir, skillName, "SKILL.md");
    let sha256: string | undefined;
    let targets: string[] | undefined;

    if (existsSync(skillMdPath)) {
      const content = readFileSync(skillMdPath, "utf-8");
      sha256 = computeSkillHash(content);
      targets = ["SKILL.md"];
    }

    lockfile = addSkillToLockfile(lockfile, skillName, "1.0.0", sha256, targets, "builtin:p0");
  }

  writeFileSync(fullPath, JSON.stringify(lockfile, null, 2) + "\n", "utf-8");
}
