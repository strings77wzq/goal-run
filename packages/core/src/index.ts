export { DiagnosticSchema, createError, createWarning, createInfo } from './diagnostic.js';
export type { Diagnostic, DiagnosticOpts } from './diagnostic.js';
export {
  resolveSafe,
  readFileSafe,
  writeFileSafe,
  fileExists,
  ensureDir,
  readYamlSafe,
  copyFileSafe,
} from './fs.js';
export { SkillMetadataSchema, RiskEnum, parseSkillMd } from './skill-parser.js';
export type { SkillMetadata, ParseResult, ParseSuccess, ParseFailure } from './skill-parser.js';
export {
  GoalSpecSchema,
  BudgetSchema,
  PolicyGateSchema,
  VerificationSchema,
  PipelineStageSchema,
  PIPELINE_STAGES,
  TaskSpecSchema,
  ADRSchema,
  AcceptanceCriterionSchema,
  FileBoundarySchema,
  EcosystemSchema,
  parseGoalSpec,
} from './goal-schema.js';
export type {
  GoalSpec,
  GoalParseSuccess,
  GoalParseFailure,
  GoalParseResult,
  PipelineStage,
  TaskSpec,
  ADR,
  AcceptanceCriterion,
  FileBoundary,
  EcosystemConfig,
} from './goal-schema.js';
export {
  PolicyConfigSchema,
  DEFAULT_POLICY,
  parsePolicyConfig,
  parsePolicyConfigSafe,
} from './policy-schema.js';
export type { PolicyConfig } from './policy-schema.js';
export {
  LockfileSchema,
  LockfileSkillSchema,
  createLockfile,
  addSkillToLockfile,
  removeSkillFromLockfile,
  hasSkill,
  getSkillInfo,
  computeSkillHash,
  verifyIntegrity,
} from './lockfile.js';
export type { Lockfile, LockfileSkill } from './lockfile.js';
export {
  SelectionTestsSchema,
  SelectionTestSchema,
  parseSelectionTests,
} from './selection-test.js';
export type { SelectionTest, SelectionTests } from './selection-test.js';
export {
  RunStateSchema,
  RunStatusSchema,
  createRunState,
  advanceState,
  canAdvanceTo,
  isTerminal,
  createCheckpoint,
  updateCriteriaStatus,
  allCriteriaPassed,
  isBudgetExhausted,
  VALID_TRANSITIONS,
  RUN_STATUSES,
  needsHumanInput,
  autoAdvance,
  AUTO_TRANSITIONS,
} from './run-state.js';
export type {
  RunState,
  RunStatus,
  Checkpoint,
  CriterionStatus,
  AutoAdvanceResult,
} from './run-state.js';
export {
  verifyDiffBoundaries,
  verifyCriteriaAutomatically,
  verifyEvidenceExists,
} from './verification.js';
export type { VerificationResult } from './verification.js';
export {
  checkDestructiveChange,
  checkAbstractionReuse,
} from './destructive-change.js';
export type { DestructiveChangeResult } from './destructive-change.js';
export {
  detectExternalApiReference,
  checkAntiHallucination,
} from './anti-hallucination.js';
export type { AntiHallucinationResult } from './anti-hallucination.js';
export {
  detectEcosystem,
  generateBootstrapPlan,
} from './ecosystem.js';
export type { EcosystemDetection, BootstrapPlan } from './ecosystem.js';
export { generateHandoff, TARGETS } from './adapter.js';
export type { HandoffTarget, HandoffPlan } from './adapter.js';
export { compareRuns } from './compare.js';
export type { RunDiff } from './compare.js';
export { parseIssueUrl, generateGoalFromIssue, generateGoalFromTitle } from './from-issue.js';
export type { IssueInfo } from './from-issue.js';
export {
  isGitRepo,
  getMainBranch,
  GOALRUN_BRANCH_PREFIX,
  isGoalrunManagedBranch,
  createWorktree,
  removeWorktree,
  listWorktrees,
  hasWorktrees,
} from './worktree.js';
export {
  captureDiff,
  captureStagedDiff,
  captureFullDiff,
  getChangedFiles,
  getChangeStats,
  saveDiffPatch,
} from './diff.js';
