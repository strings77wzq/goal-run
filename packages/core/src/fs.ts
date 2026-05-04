import { readFile, writeFile, mkdir, access, copyFile } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { Diagnostic } from "./diagnostic.js";
import { createError } from "./diagnostic.js";

export function resolveSafe(repoRoot: string, relativePath: string): string {
  const resolved = resolve(repoRoot, relativePath);
  const rel = relative(repoRoot, resolved);
  if (rel.startsWith("..")) {
    throw new Error(`Path traversal detected: "${relativePath}" resolves outside repo root`);
  }
  return resolved;
}

function validatePath(repoRoot: string, relativePath: string): string {
  return resolveSafe(repoRoot, relativePath);
}

export async function readFileSafe(repoRoot: string, relativePath: string): Promise<string> {
  const fullPath = validatePath(repoRoot, relativePath);
  return readFile(fullPath, "utf-8");
}

export async function writeFileSafe(
  repoRoot: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const fullPath = validatePath(repoRoot, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
}

export async function fileExists(repoRoot: string, relativePath: string): Promise<boolean> {
  const fullPath = validatePath(repoRoot, relativePath);
  try {
    await access(fullPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(repoRoot: string, relativePath: string): Promise<void> {
  const fullPath = validatePath(repoRoot, relativePath);
  await mkdir(fullPath, { recursive: true });
}

export async function readYamlSafe<T = unknown>(
  repoRoot: string,
  relativePath: string,
): Promise<T> {
  const content = await readFileSafe(repoRoot, relativePath);
  const parsed = parseYaml(content);
  if (parsed === null || parsed === undefined) {
    throw new Error(`Empty or invalid YAML in "${relativePath}"`);
  }
  return parsed as T;
}

export async function copyFileSafe(
  repoRoot: string,
  srcRel: string,
  destRel: string,
): Promise<void> {
  const srcPath = validatePath(repoRoot, srcRel);
  const destPath = validatePath(repoRoot, destRel);
  await mkdir(dirname(destPath), { recursive: true });
  await copyFile(srcPath, destPath);
}
