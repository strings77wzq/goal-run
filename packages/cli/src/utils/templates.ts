import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTemplatesDir, getBuiltinSkillsDir } from "./config.js";

export function readTemplate(relativePath: string): string {
  const fullPath = resolve(getTemplatesDir(), relativePath);
  return readFileSync(fullPath, "utf-8");
}

export function getSkillTemplate(): string {
  return readTemplate("skill/SKILL.md");
}

export function getRepoInitFiles(): { dest: string; content: string }[] {
  const templatesDir = getTemplatesDir();
  const repoDir = resolve(templatesDir, "repo");

  return [
    {
      dest: "AGENTS.md",
      content: readFileSync(resolve(repoDir, "AGENTS.md"), "utf-8"),
    },
    {
      dest: ".goalrun/config.yaml",
      content: readFileSync(resolve(repoDir, "config.yaml"), "utf-8"),
    },
    {
      dest: ".goalrun/policy.yaml",
      content: readFileSync(resolve(repoDir, "policy.yaml"), "utf-8"),
    },
    {
      dest: ".goalrun/goals/example-fix-bug.yaml",
      content: readFileSync(resolve(repoDir, "goals/example-fix-bug.yaml"), "utf-8"),
    },
    {
      dest: ".goalrun/tests/selection.yaml",
      content: readFileSync(resolve(repoDir, "tests/selection.yaml"), "utf-8"),
    },
  ];
}

export function getBuiltinSkillContent(skillName: string): string | null {
  const skillsDir = getBuiltinSkillsDir();
  const skillPath = resolve(skillsDir, skillName, "SKILL.md");
  try {
    return readFileSync(skillPath, "utf-8");
  } catch {
    return null;
  }
}

export function getBuiltinSkillNames(): string[] {
  return ["implementation-strategy", "tdd-change", "code-review"];
}
