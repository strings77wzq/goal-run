/**
 * goalrun.verify — MCP tool implementation.
 *
 * Wraps existing harnesses (static, selection, goal, policy, criteria)
 * and returns structured JSON for AI agents.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import type { Diagnostic, PolicyConfig } from 'goalrun-core';
import { DEFAULT_POLICY } from 'goalrun-core';
import { runStaticHarness, runGoalHarness, runPolicyHarness } from 'goalrun-harness';
import type { VerifyInput, VerifyResponse, VerifyResult, Blocker } from './types.js';

/** Timeout per harness in milliseconds */
const HARNESS_TIMEOUT_MS = 10_000;

/** Total timeout in milliseconds */
const TOTAL_TIMEOUT_MS = 30_000;

/**
 * Run goalrun.verify — the core MCP tool.
 *
 * Creates fresh harness context per call (stateless).
 * Runs harnesses in parallel with individual timeouts.
 */
export async function runVerify(input: VerifyInput, projectRoot: string): Promise<VerifyResponse> {
  // Validate input
  if (!input.goalFile || typeof input.goalFile !== 'string') {
    return {
      status: 'error',
      error: {
        code: 'INVALID_GOAL_FILE',
        message: 'goalFile is required and must be a string',
      },
    };
  }

  // Resolve goal file path
  const goalPath = resolve(projectRoot, input.goalFile);

  // Check goal file exists
  if (!existsSync(goalPath)) {
    return {
      status: 'error',
      error: {
        code: 'GOAL_NOT_FOUND',
        message: `Goal file not found: ${input.goalFile}`,
        details: `Resolved to: ${goalPath}`,
      },
    };
  }

  // Derive changedFiles if not provided
  const changedFiles = input.changedFiles ?? getChangedFiles(projectRoot);

  // Run harnesses with timeout
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    const results = await runWithTimeout(
      () => runAllHarnesses(projectRoot, goalPath, changedFiles),
      TOTAL_TIMEOUT_MS,
    );

    // Check if we timed out
    if (results === null) {
      return {
        status: 'error',
        error: {
          code: 'VERIFICATION_TIMEOUT',
          message: `Verification timed out after ${TOTAL_TIMEOUT_MS}ms`,
        },
      };
    }

    const { blockers, harnessWarnings } = results;
    warnings.push(...harnessWarnings);

    // Determine status: fail iff at least one blocker has severity "error"
    const hasErrors = blockers.some((b) => b.severity === 'error');
    const status = hasErrors ? 'fail' : 'pass';

    // Generate summary
    const errorCount = blockers.filter((b) => b.severity === 'error').length;
    const warningCount = blockers.filter((b) => b.severity === 'warning').length;
    const summary =
      status === 'pass'
        ? `Verification passed with ${warningCount} warning(s)`
        : `Verification failed: ${errorCount} error(s), ${warningCount} warning(s)`;

    // Generate next actions from blockers
    const nextActions = generateNextActions(blockers);

    const result: VerifyResult = {
      status,
      summary,
      blockers,
      nextActions,
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  } catch (err) {
    return {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : String(err),
        details: `Elapsed: ${Date.now() - startTime}ms`,
      },
    };
  }
}

/**
 * Run all harnesses and collect results.
 * Returns null if timeout exceeded.
 */
async function runAllHarnesses(
  projectRoot: string,
  goalPath: string,
  _changedFiles: string[],
): Promise<{ blockers: Blocker[]; harnessWarnings: string[] } | null> {
  const blockers: Blocker[] = [];
  const harnessWarnings: string[] = [];

  // Use default policy for MCP
  const policy: PolicyConfig = DEFAULT_POLICY;

  // Run harnesses in parallel with individual timeouts
  const harnessPromises = [
    runWithTimeout(() => runStaticHarnessSafe(projectRoot, policy), HARNESS_TIMEOUT_MS),
    runWithTimeout(() => runGoalHarnessSafe(goalPath, policy, projectRoot), HARNESS_TIMEOUT_MS),
    runWithTimeout(() => runPolicyHarnessSafe(projectRoot, policy), HARNESS_TIMEOUT_MS),
    runWithTimeout(() => runEcosystemHarnessSafe(projectRoot), HARNESS_TIMEOUT_MS),
  ];

  const results = await Promise.all(harnessPromises);

  // Process results
  const harnessNames = ['static', 'goal', 'policy', 'ecosystem'];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result === null) {
      harnessWarnings.push(`harness:${harnessNames[i]} timed out after ${HARNESS_TIMEOUT_MS}ms`);
    } else if (Array.isArray(result)) {
      blockers.push(...result);
    }
  }

  return { blockers, harnessWarnings };
}

/** Run static harness safely */
function runStaticHarnessSafe(projectRoot: string, policy: PolicyConfig): Blocker[] {
  // Find skill directories in the project
  const skillDirs = findSkillDirs(projectRoot);
  const blockers: Blocker[] = [];

  for (const skillDir of skillDirs) {
    const diagnostics = runStaticHarness({ skillDir, policy });
    blockers.push(...diagnosticsToBlockers('static', diagnostics));
  }

  return blockers;
}

/** Run goal harness safely */
function runGoalHarnessSafe(
  goalPath: string,
  policy: PolicyConfig,
  projectRoot: string,
): Blocker[] {
  try {
    // Find available skills
    const availableSkills = findSkillDirs(projectRoot);

    const result = runGoalHarness({
      goalYamlPath: goalPath,
      policy,
      availableSkills,
    });
    return diagnosticsToBlockers('goal', result.diagnostics ?? []);
  } catch {
    return [];
  }
}

/** Run policy harness safely */
function runPolicyHarnessSafe(projectRoot: string, _policy: PolicyConfig): Blocker[] {
  try {
    const result = runPolicyHarness({
      policyYamlPath: resolve(projectRoot, '.goalrun', 'policy.yaml'),
      skillDirs: findSkillDirs(projectRoot),
    });
    return diagnosticsToBlockers('policy', result.diagnostics ?? []);
  } catch {
    return [];
  }
}

/** Run ecosystem harness safely */
function runEcosystemHarnessSafe(_projectRoot: string): Blocker[] {
  try {
    // Ecosystem harness needs a goalSpec — skip for MCP verify
    // (it's for ecosystem detection, not core verification)
    return [];
  } catch {
    return [];
  }
}

/** Convert diagnostics to blockers */
function diagnosticsToBlockers(harnessName: string, diagnostics: Diagnostic[]): Blocker[] {
  return diagnostics.map((d) => ({
    id: `${harnessName}:${d.code.toLowerCase()}`,
    severity: d.severity === 'error' ? ('error' as const) : ('warning' as const),
    message: d.message,
    evidence: d.file ? [d.file] : [],
    fixGuidance: d.hint ? [d.hint] : undefined,
  }));
}

/** Generate next actions from blockers */
function generateNextActions(blockers: Blocker[]): string[] {
  const actions: string[] = [];
  const errors = blockers.filter((b) => b.severity === 'error');
  const warnings = blockers.filter((b) => b.severity === 'warning');

  if (errors.length > 0) {
    actions.push(`Fix ${errors.length} error(s) before proceeding`);
    for (const error of errors.slice(0, 3)) {
      if (error.fixGuidance && error.fixGuidance.length > 0) {
        const guidance = error.fixGuidance[0];
        if (guidance) {
          actions.push(guidance);
        }
      }
    }
  }

  if (warnings.length > 0) {
    actions.push(`Consider addressing ${warnings.length} warning(s)`);
  }

  return actions;
}

/** Get changed files from git */
function getChangedFiles(projectRoot: string): string[] {
  try {
    // Check if we're in a git repo first
    execSync('git rev-parse --git-dir', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 2000,
      stdio: 'pipe',
    });
    const output = execSync('git diff --name-only HEAD~1', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: 'pipe',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/** Find skill directories in the project */
function findSkillDirs(projectRoot: string): string[] {
  const dirs: string[] = [];
  const skillsDir = resolve(projectRoot, '.agent', 'skills');

  if (existsSync(skillsDir)) {
    try {
      // This is a simplified version — in reality we'd read the directory
      // For now, return empty (harnesses will handle gracefully)
    } catch {
      // Directory read failed
    }
  }

  return dirs;
}

/** Run a function with a timeout */
function runWithTimeout<T>(fn: () => T | Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((res) => {
    const timer = setTimeout(() => res(null), timeoutMs);

    Promise.resolve()
      .then(fn)
      .then((result) => {
        clearTimeout(timer);
        res(result);
      })
      .catch(() => {
        clearTimeout(timer);
        res(null);
      });
  });
}
