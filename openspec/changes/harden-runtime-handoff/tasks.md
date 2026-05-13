## 1. Regression Tests

- [x] 1.1 Add handoff adapter tests that assert each supported target uses its configured skill path consistently.
- [x] 1.2 Add a CLI run regression test proving `runCommand(..., { dryRun: true, isolated: true })` does not create a run directory, run state/checkpoint artifacts, worktree, or branch.
- [x] 1.3 Add worktree safety tests for create/remove repo-root containment and shell-free argument invocation behavior.
- [x] 1.4 Fix stale CLI smoke test typings without changing command behavior.
- [x] 1.5 Add rollback tests proving unmanaged branch names are not deleted.

## 2. Implementation

- [x] 2.1 Update `generateHandoff` to use target-specific skill paths in shared context, ordered skill list, and runtime instructions.
- [x] 2.2 Reorder `runCommand` so dry-run mode previews isolated paths without creating worktrees or run files.
- [x] 2.3 Harden worktree helpers with create/remove repo-root containment checks and structured git arguments.
- [x] 2.4 Harden rollback branch deletion to use structured git arguments and only delete GoalRun-managed branch names.

## 3. Verification

- [x] 3.1 Run targeted tests for core worktree and CLI handoff/run behavior.
- [x] 3.2 Run project typecheck and confirm the existing smoke-test diagnostics are gone.
- [x] 3.3 Run full test, lint, and build checks required by the project guide.
- [x] 3.4 Review changed files for scope creep, security regressions, and instruction consistency.
