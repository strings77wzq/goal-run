import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Diagnostic } from './diagnostic.js';
import { createError, createWarning, createInfo } from './diagnostic.js';

export interface VerificationResult {
  success: boolean;
  diagnostics: Diagnostic[];
  evidence: Record<string, unknown>;
}

/**
 * Verify that changed files are within declared file boundaries.
 * Compares git diff --name-only against task's write_files globs.
 */
export function verifyDiffBoundaries(
  repoRoot: string,
  writeFiles: string[],
  taskTitle: string,
): VerificationResult {
  const diagnostics: Diagnostic[] = [];
  const evidence: Record<string, unknown> = {};

  try {
    const diffOutput = execSync('git diff --name-only HEAD', {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();

    if (!diffOutput) {
      evidence.changed_files = [];
      return { success: true, diagnostics, evidence };
    }

    const changedFiles = diffOutput.split('\n').filter(Boolean);
    evidence.changed_files = changedFiles;

    // Check each changed file against write boundaries
    const outOfBounds: string[] = [];
    for (const file of changedFiles) {
      const withinBoundary = writeFiles.some((pattern) => {
        // Simple glob matching: support * wildcard
        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        return regex.test(file);
      });
      if (!withinBoundary) {
        outOfBounds.push(file);
      }
    }

    if (outOfBounds.length > 0) {
      diagnostics.push(
        createError(
          'DIFF_BOUNDARY_VIOLATION',
          `Task "${taskTitle}" changed files outside declared boundaries`,
          {
            hint: `Out-of-bounds files: ${outOfBounds.join(', ')}. Expected within: ${writeFiles.join(', ')}`,
          },
        ),
      );
      evidence.out_of_bounds = outOfBounds;
      return { success: false, diagnostics, evidence };
    }

    return { success: true, diagnostics, evidence };
  } catch {
    // Not in a git repo or git not available
    diagnostics.push(
      createInfo('DIFF_VERIFY_SKIP', 'Could not verify diff boundaries (not a git repo)', {}),
    );
    return { success: true, diagnostics, evidence };
  }
}

/**
 * Automatically verify criteria by running verification commands.
 * Returns pass/fail for each criterion based on command exit codes.
 */
export function verifyCriteriaAutomatically(
  repoRoot: string,
  verificationCommands: string[],
): VerificationResult {
  const diagnostics: Diagnostic[] = [];
  const evidence: Record<string, unknown> = { results: [] };

  const results: { command: string; exitCode: number; passed: boolean; output: string }[] = [];

  for (const cmd of verificationCommands) {
    try {
      const output = execSync(cmd, {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      results.push({ command: cmd, exitCode: 0, passed: true, output: output.slice(0, 500) });
    } catch (err: unknown) {
      const execErr = err as { status?: number; stdout?: string; stderr?: string };
      results.push({
        command: cmd,
        exitCode: execErr.status ?? 1,
        passed: false,
        output: (execErr.stderr ?? execErr.stdout ?? '').slice(0, 500),
      });
    }
  }

  evidence.results = results;

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    for (const f of failed) {
      diagnostics.push(
        createError('VERIFY_COMMAND_FAILED', `Verification command failed: ${f.command}`, {
          hint: `Exit code: ${f.exitCode}. Output: ${f.output}`,
        }),
      );
    }
    return { success: false, diagnostics, evidence };
  }

  return { success: true, diagnostics, evidence };
}

/**
 * Verify that TDD evidence exists (failing test captured before implementation).
 * Checks for evidence files in the run's verification directory.
 */
export function verifyEvidenceExists(
  verificationDir: string,
  requiredEvidence: string[],
): VerificationResult {
  const diagnostics: Diagnostic[] = [];
  const evidence: Record<string, unknown> = {};

  const missing: string[] = [];
  for (const ev of requiredEvidence) {
    const evPath = resolve(verificationDir, ev);
    if (!existsSync(evPath)) {
      missing.push(ev);
    } else {
      evidence[ev] = readFileSync(evPath, 'utf-8').slice(0, 200);
    }
  }

  if (missing.length > 0) {
    diagnostics.push(
      createWarning('EVIDENCE_MISSING', `Missing TDD evidence files: ${missing.join(', ')}`, {
        hint: 'The agent must capture failing test output before implementing. Save evidence to the verification/ directory.',
      }),
    );
    return { success: false, diagnostics, evidence };
  }

  return { success: true, diagnostics, evidence };
}
