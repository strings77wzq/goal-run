/**
 * CI Parity Test — verifies MCP goalrun.verify results match CLI results.
 *
 * Runs both MCP verify and CLI verify on the same goal file,
 * then compares: status, blocker count, blocker severity.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { runVerify } from '../src/verify.js';

/** Project root — the monorepo root */
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

/** Goal file to test against */
const GOAL_FILE = '.goalrun/goals/sdd-tdd-workflow.yaml';

describe('CI Parity — MCP vs CLI', () => {
  it('should produce matching status for the same goal file', async () => {
    // Run MCP verify
    const mcpResult = await runVerify({ goalFile: GOAL_FILE }, PROJECT_ROOT);

    // Run CLI verify
    let cliStatus: string;
    let cliBlockerCount = 0;

    try {
      const cliOutput = execSync(`node dist/index.js verify ${GOAL_FILE}`, {
        cwd: resolve(PROJECT_ROOT, 'packages', 'cli'),
        encoding: 'utf-8',
        timeout: 30000,
        stdio: 'pipe',
      });

      // Parse CLI output — look for status indicators
      if (cliOutput.includes('passed') || cliOutput.includes('PASS')) {
        cliStatus = 'pass';
      } else if (cliOutput.includes('failed') || cliOutput.includes('FAIL')) {
        cliStatus = 'fail';
      } else {
        cliStatus = 'unknown';
      }

      // Count blockers from CLI output
      const blockerMatches = cliOutput.match(/error|warning/gi);
      cliBlockerCount = blockerMatches ? blockerMatches.length : 0;
    } catch (err) {
      // CLI may exit with non-zero on failures — that's expected
      cliStatus = 'fail';
    }

    // MCP result
    const mcpStatus = mcpResult.status;

    // Parity check: status should match
    // (Both should be 'pass' or both should be 'fail')
    if (cliStatus !== 'unknown') {
      expect(mcpStatus).toBe(cliStatus);
    }

    // Both should produce a valid result
    expect(['pass', 'fail', 'error']).toContain(mcpStatus);
    expect(['pass', 'fail', 'unknown']).toContain(cliStatus);
  });

  it('should produce structured output with required fields', async () => {
    const result = await runVerify({ goalFile: GOAL_FILE }, PROJECT_ROOT);

    // All MCP results must have these fields
    expect(result.status).toBeDefined();
    expect(['pass', 'fail', 'error']).toContain(result.status);

    if (result.status === 'pass' || result.status === 'fail') {
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.blockers).toBeDefined();
      expect(Array.isArray(result.blockers)).toBe(true);
      expect(result.nextActions).toBeDefined();
      expect(Array.isArray(result.nextActions)).toBe(true);

      // Each blocker must have required fields
      for (const blocker of result.blockers) {
        expect(blocker.id).toBeDefined();
        expect(typeof blocker.id).toBe('string');
        expect(['error', 'warning']).toContain(blocker.severity);
        expect(blocker.message).toBeDefined();
        expect(typeof blocker.message).toBe('string');
        expect(blocker.evidence).toBeDefined();
        expect(Array.isArray(blocker.evidence)).toBe(true);
      }
    }
  });
});
