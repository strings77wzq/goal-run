## Context

GoalRun currently has the right architectural split for this change: `packages/core` owns reusable contracts and git helpers, while `packages/cli` turns those contracts into commands. The current gaps are concentrated at the boundary between human-readable workflow output and trustworthy command behavior:

- `generateHandoff` has target metadata, but its common context still points at `.agent/skills/<name>/SKILL.md` for every runtime.
- `goalrun run --isolated --dry-run` computes isolation by creating a worktree before the dry-run branch.
- Worktree and rollback helpers call `git` through shell strings even though the arguments are structured values.
- CLI smoke tests have drifted from the command function type and currently break TypeScript diagnostics.

The project rules prohibit executing user project verification commands and require all file writes to stay inside the repo root. This design preserves those boundaries.

## Goals / Non-Goals

**Goals:**

- Produce handoff output whose skill paths and runtime instructions are internally consistent for Claude, Codex, Cursor, and OpenCode.
- Keep one canonical handoff payload shape so future orchestration and token-ledger fields can be added without rewriting every runtime adapter.
- Ensure dry-run mode is non-mutating, including isolated run setup.
- Ensure worktree creation/removal and branch deletion use structured git arguments and repo-root containment checks.
- Restore project typecheck by fixing stale CLI tests and adding regressions for the safety behavior.

**Non-Goals:**

- Add token usage/cost accounting. That is proposal 1 and remains separate.
- Add new OpenSpec-to-GoalRun commands.
- Execute verification commands from goal specs.
- Replace the current Commander CLI or introduce a new workflow engine.

## Decisions

1. **Keep runtime adapters thin.**

   `TARGET_CONFIGS` remains the source of runtime-specific names, config files, and skill paths. `generateHandoff` will use those values consistently in the shared context and skill list instead of hard-coding `.agent/skills`.

   Alternative considered: create separate full templates per runtime. Rejected because it would duplicate policy, criteria, and verification language, increasing drift.

2. **Make dry-run return before isolation side effects.**

   `runCommand` will compute and print intended paths in dry-run mode without creating directories or worktrees. The dry-run output can say which worktree path would be used, but it must not call `createWorktree`.

   Alternative considered: create and immediately remove a temporary worktree to validate git behavior. Rejected because dry-run must be side-effect free.

3. **Use structured git invocation for local git helpers.**

   Git commands in worktree and rollback code will use `spawnSync` or equivalent argument arrays. Worktree paths will be resolved through repo-root containment before invoking git for both creation and removal. Rollback will only delete branches that match GoalRun's managed branch convention.

   Alternative considered: escape shell strings. Rejected because argument arrays are simpler and avoid shell parsing entirely.

4. **Treat test type drift as a product reliability bug.**

   Tests should call command functions with their actual exported types, and CLI wrapper behavior should be tested at the appropriate boundary. The first fix will keep the public command behavior unchanged while restoring typecheck.

## Risks / Trade-offs

- **Risk: target-specific handoff wording still misses runtime conventions** -> Mitigation: keep the adapter data centralized and cover each target with tests that assert skill path consistency.
- **Risk: stricter path containment rejects unusual but valid worktree paths** -> Mitigation: allow only repo-contained relative paths for GoalRun-managed worktrees; that matches project security rules.
- **Risk: structured git helpers change error messages** -> Mitigation: preserve success/failure shape and assert behavior rather than exact low-level git stderr.
- **Risk: this change does not solve token visibility yet** -> Mitigation: keep handoff payload canonical so proposal 1 can add usage fields later without changing every runtime adapter.
