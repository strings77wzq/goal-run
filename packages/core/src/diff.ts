import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function captureDiff(
  repoRoot: string,
  stagedOnly = false,
): { success: true; diff: string } | { success: false; error: string } {
  try {
    const cmd = stagedOnly ? 'git diff --staged' : 'git diff';
    const diff = execSync(cmd, {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024, // 10MB max diff
    });
    return { success: true, diff: diff || '(no changes)' };
  } catch (err) {
    return { success: false, error: `Failed to capture diff: ${String(err)}` };
  }
}

export function captureStagedDiff(
  repoRoot: string,
): { success: true; diff: string } | { success: false; error: string } {
  return captureDiff(repoRoot, true);
}

export function captureFullDiff(
  repoRoot: string,
): { success: true; diff: string } | { success: false; error: string } {
  try {
    const cmd = 'git diff HEAD';
    const diff = execSync(cmd, {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { success: true, diff: diff || '(no changes from HEAD)' };
  } catch (err) {
    return { success: false, error: `Failed to capture full diff: ${String(err)}` };
  }
}

export function getChangedFiles(repoRoot: string): string[] {
  try {
    const output = execSync('git diff --name-only', {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 5000,
    });
    return output
      .trim()
      .split('\n')
      .filter((f) => f.length > 0);
  } catch {
    return [];
  }
}

export function getChangeStats(repoRoot: string): {
  files: number;
  insertions: number;
  deletions: number;
} {
  try {
    const output = execSync('git diff --shortstat', {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 5000,
    });
    const re =
      /(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/;
    const match = re.exec(output);
    if (match) {
      return {
        files: parseInt(match[1] ?? '0', 10) || 0,
        insertions: parseInt(match[2] ?? '0', 10) || 0,
        deletions: parseInt(match[3] ?? '0', 10) || 0,
      };
    }
  } catch {
    // No changes
  }
  return { files: 0, insertions: 0, deletions: 0 };
}

export function saveDiffPatch(
  repoRoot: string,
  outputPath: string,
): { success: true; path: string } | { success: false; error: string } {
  const result = captureDiff(repoRoot);
  if (!result.success) return result;

  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, result.diff, 'utf-8');
    return { success: true, path: outputPath };
  } catch (err) {
    return { success: false, error: `Failed to save diff: ${String(err)}` };
  }
}
