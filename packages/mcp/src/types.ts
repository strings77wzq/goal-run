/**
 * MCP Server types for GoalRun verification.
 */

/** Input for goalrun.verify tool */
export interface VerifyInput {
  /** Relative path to goal YAML file (e.g., ".goalrun/goals/sdd-tdd-workflow.yaml") */
  goalFile: string;
  /** Files modified since last commit. If omitted, derived from git diff. */
  changedFiles?: string[];
  /** Reserved/ignored in MVP (always returns JSON) */
  mode?: 'agent' | 'human';
}

/** Blocker returned by verification */
export interface Blocker {
  /** Canonical ID: "{harnessName}:{category}:{detail}" (e.g., "static:missing-test") */
  id: string;
  /** "error" = must fix; "warning" = should fix but not blocking */
  severity: 'error' | 'warning';
  /** Human-readable description */
  message: string;
  /** Specific file:line references or test names */
  evidence: string[];
  /** Optional concrete steps to fix */
  fixGuidance?: string[];
}

/** Successful verification result */
export interface VerifyResult {
  /** "fail" iff at least one blocker has severity "error" */
  status: 'pass' | 'fail';
  /** One-line human-readable summary */
  summary: string;
  /** List of blockers found */
  blockers: Blocker[];
  /** Concrete next steps derived from blockers */
  nextActions: string[];
  /** Partial-timeout messages */
  warnings?: string[];
}

/** Error verification result */
export interface VerifyError {
  status: 'error';
  error: {
    code: 'INVALID_GOAL_FILE' | 'GOAL_NOT_FOUND' | 'VERIFICATION_TIMEOUT' | 'INTERNAL_ERROR';
    message: string;
    details?: string;
  };
}

/** Union of all verification responses */
export type VerifyResponse = VerifyResult | VerifyError;
