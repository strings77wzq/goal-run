## Why

The reporter package currently only outputs text and JSON. For CI/CD integration, the industry standards are SARIF (natively ingested by GitHub code scanning) and JUnit XML (test result dashboards in GitHub Actions, GitLab CI, Jenkins). Adding these formats makes GoalRun's security and criteria diagnostics directly actionable in CI pipelines without custom parsing.

## What Changes

- Add `formatSarif()` to `packages/reporter/src/format.ts` — SARIF v2.1.0 output mapping each diagnostic to a `reportingDescriptor` with rule metadata
- Add `formatJunit()` to `packages/reporter/src/format.ts` — JUnit XML test suite output treating each diagnostic as a test case
- Add `--format` option (`text|json|sarif|junit`) to `verify`, `lint`, and `test` CLI commands
- Export new format functions and types from `packages/reporter/src/index.ts`

## Capabilities

### New Capabilities

- `reporter-sarif-output`: SARIF v2.1.0 formatting for security and criteria diagnostics, compatible with GitHub code scanning
- `reporter-junit-output`: JUnit XML formatting for test/criteria diagnostics, compatible with CI test result dashboards

### Modified Capabilities

None — existing `formatText()` and `formatJson()` behavior is preserved.

## Impact

- Affected packages: `packages/reporter` (primary), `packages/cli` (new `--format` flag on verify/lint/test commands)
- Affected commands: `goalrun verify`, `goalrun lint`, `goalrun test`
- No new runtime dependencies (SARIF and JUnit are plain string/XML output)
- No breaking changes
- Tests: new format functions need dedicated test coverage; CLI flag plumbing needs smoke test coverage
