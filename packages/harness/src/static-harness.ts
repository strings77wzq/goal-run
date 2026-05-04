import {
  parseSkillMd,
  type Diagnostic,
  createError,
  createWarning,
  createInfo,
} from "@strings77wzq/goalrun-core";
import { scanForSecrets, scanForBlockedCommands, scanForPromptInjection, scanForExternalUrls } from "@strings77wzq/goalrun-security";
import type { PolicyConfig } from "@strings77wzq/goalrun-core";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";

export interface StaticHarnessInput {
  skillDir: string;
  policy: PolicyConfig;
}

export function runStaticHarness(input: StaticHarnessInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const skillMdPath = resolve(input.skillDir, "SKILL.md");

  if (!existsSync(skillMdPath)) {
    diagnostics.push(
      createError("SKILL_MISSING_SKILLMD", `No SKILL.md found in ${input.skillDir}`, {
        file: skillMdPath,
        hint: "Every skill directory must contain a SKILL.md file",
      }),
    );
    return diagnostics;
  }

  const content = readFileSync(skillMdPath, "utf-8");
  const parsed = parseSkillMd(content, skillMdPath);

  if (!parsed.success) {
    diagnostics.push(...parsed.diagnostics);
    return diagnostics;
  }

  diagnostics.push(...parsed.diagnostics);

  const { metadata, body } = parsed;

  if (!diagnostics.some((d) => d.code === "SKILL_NAME_MISMATCH")) {
    const dirName = basename(input.skillDir);
    if (dirName && metadata.name !== dirName) {
      diagnostics.push(
        createWarning(
          "SKILL_NAME_MISMATCH",
          `Skill name "${metadata.name}" does not match directory name "${dirName}"`,
          { file: skillMdPath },
        ),
      );
    }
  }

  // Check permissions are declared
  if (metadata.permissions.length === 0) {
    diagnostics.push(
      createWarning("SKILL_NO_PERMISSIONS", `Skill "${metadata.name}" declares no permissions`, {
        file: skillMdPath,
      }),
    );
  }

  // Scan for secrets
  const secretDiags = scanForSecrets(body, skillMdPath);
  diagnostics.push(...secretDiags);

  // Scan for blocked commands
  const blockedDiags = scanForBlockedCommands(body, skillMdPath, input.policy.blocked_commands);
  diagnostics.push(...blockedDiags);

  // Scan for prompt injection
  const injectionDiags = scanForPromptInjection(body, skillMdPath);
  diagnostics.push(...injectionDiags);

  // Scan for external URLs
  const urlDiags = scanForExternalUrls(body, skillMdPath);
  diagnostics.push(...urlDiags);

  // Check referenced resources
  const skillDir = dirname(skillMdPath);
  const resourceDirs = ["references", "scripts", "assets"];
  for (const dir of resourceDirs) {
    const refPath = resolve(skillDir, dir);
    const refMdPath = resolve(skillDir, dir, "index.md");
    if (existsSync(refPath) && !existsSync(refMdPath)) {
      diagnostics.push(
        createInfo("SKILL_REFERENCE_FOUND", `Directory "${dir}/" exists but no documentation found`, {
          file: skillMdPath,
        }),
      );
    }
  }

  // Check body is not empty
  if (body.trim().length < 20) {
    diagnostics.push(
      createWarning("SKILL_EMPTY_BODY", `SKILL.md body is very short (${body.trim().length} chars)`, {
        file: skillMdPath,
        hint: "Add detailed instructions for agents following this skill",
      }),
    );
  }

  return diagnostics;
}
