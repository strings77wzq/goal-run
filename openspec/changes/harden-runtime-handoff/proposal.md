## Why

GoalRun aims to be the harness that lets a human drive serious AI-assisted engineering across Claude, Codex, OpenCode, and related runtimes, but the current handoff contract is inconsistent and the CLI reliability layer has active type drift. This change strengthens the workflow surface before adding larger governance features such as token ledgers.

## What Changes

- Define a canonical runtime handoff contract with target-specific skill paths and consistent execution instructions for Claude, Codex, Cursor, and OpenCode.
- Remove contradictory handoff wording that mixes `.agent/skills` with runtime-specific skill locations.
- Harden `goalrun run --isolated --dry-run` so dry-run mode never creates git worktrees or mutates repository state.
- Strengthen worktree and rollback command safety by enforcing repo-root path containment and avoiding shell interpolation for git commands.
- Repair CLI smoke test type drift so project typecheck is green.
- Add regression tests for dry-run isolation behavior and worktree path containment.

## Capabilities

### New Capabilities

- `runtime-handoff-contract`: Canonical, runtime-specific handoff output for Claude, Codex, Cursor, and OpenCode.
- `workflow-reliability-hardening`: CLI and worktree safety behavior required for trustworthy supervised runs.

### Modified Capabilities

## Impact

- Affected packages: `packages/core`, `packages/cli`.
- Affected commands: `goalrun handoff`, `goalrun run`, `goalrun rollback`.
- Affected tests: CLI smoke/path safety tests and core worktree tests.
- No new runtime dependency is expected.
- No external LLM API calls or user project verification commands are introduced.
