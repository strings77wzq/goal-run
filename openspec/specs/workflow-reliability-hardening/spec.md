## Purpose

Define the safety and reliability behavior required for GoalRun supervised runs, dry-run isolation, worktree operations, rollback, and project diagnostics.

## Requirements

### Requirement: Isolated dry-run is non-mutating

The system SHALL NOT create directories, worktrees, branches, or run state files when `goalrun run` is executed with both `--dry-run` and `--isolated`.

#### Scenario: Dry-run isolated run previews worktree only

- **WHEN** `goalrun run <goal> --supervised --loop --isolated --dry-run` is requested in a git repository
- **THEN** the command reports the intended run and worktree paths without creating a worktree or run directory

### Requirement: Worktree paths stay within repo root

The system SHALL reject GoalRun-managed worktree paths that resolve outside the repository root for both creation and removal.

#### Scenario: Parent traversal creation path is rejected

- **WHEN** worktree creation is requested with a path containing parent traversal outside the repository
- **THEN** the request fails before invoking git

#### Scenario: Parent traversal removal path is rejected

- **WHEN** worktree removal is requested with a path containing parent traversal outside the repository
- **THEN** the request fails before invoking git

### Requirement: Git helper commands avoid shell interpolation

The system SHALL invoke git helper commands with structured arguments rather than shell-interpolated command strings.

#### Scenario: Worktree creation uses argument array semantics

- **WHEN** a worktree is created for an isolated run
- **THEN** path and branch values are passed to git as arguments, not interpolated into a shell command string

#### Scenario: Rollback branch deletion uses argument array semantics

- **WHEN** rollback deletes a GoalRun-created branch
- **THEN** the branch name is passed to git as an argument, not interpolated into a shell command string

### Requirement: Rollback deletes only GoalRun-managed branches

The system SHALL delete a branch during rollback only when the persisted branch name matches GoalRun's managed branch naming convention.

#### Scenario: Unmanaged branch deletion is skipped

- **WHEN** rollback state contains a branch name that does not match the GoalRun-managed branch naming convention
- **THEN** rollback does not invoke branch deletion for that name

### Requirement: Project diagnostics remain green

The system SHALL keep CLI tests aligned with exported command function types so project typecheck can pass.

#### Scenario: Smoke tests compile against command APIs

- **WHEN** TypeScript diagnostics are run for the project
- **THEN** CLI smoke tests compile without stale option or mock signature errors
