## Context

The `goalrun-reporter` package currently exports `formatText()` and `formatJson()`. Both accept `Diagnostic[]` and return a string. The reporter is consumed by the CLI's `verify`, `lint`, and `test` commands (each has a `--json` flag). No format selection mechanism exists beyond the binary text/JSON toggle.

SARIF and JUnit XML are the two most widely supported CI/CD diagnostic formats. Adding them requires zero new dependencies — both are plain structured output (JSON and XML respectively).

## Goals / Non-Goals

**Goals:**

- Add `formatSarif()` producing valid SARIF v2.1.0 JSON
- Add `formatJunit()` producing valid JUnit XML
- Add `--format text|json|sarif|junit` flag to `verify`, `lint`, `test` CLI commands
- Make `--json` a shorthand for `--format json` (backwards compatible)

**Non-Goals:**

- Full SARIF spec coverage (only `results` array with `reportingDescriptors`)
- JUnit properties/milestones support
- Changing existing `formatText()` / `formatJson()` behavior
- Adding new reporter dependencies

## Decisions

**1. SARIF structure: one tool, one run, one set of results**

SARIF allows multiple runs, tools, and rules. We produce a minimal valid document: one `tool` (goalrun), one `run`, one `result` per diagnostic. Each diagnostic code becomes a `reportingDescriptor` in `tool.driver.rules`. This keeps output compact while meeting the SARIF ingestion minimum.

Alternative considered: Per-harness runs. Rejected — our harness architecture isn't exposed at the reporter layer, and a flat result list is sufficient for code scanning.

**2. JUnit: each diagnostic = one `<testcase>`**

JUnit XML expects `<testsuite>` → `<testcase>`. We map each diagnostic to a test case where:

- `name` = diagnostic code + message
- `classname` = diagnostic file or `goalrun`
- Errors (severity=error) become `<failure>` children
- Warnings become `<skipped>` children with message
- Infos become plain passing test cases

Alternative considered: Per-file grouping. Adds complexity with no tooling benefit — most CI dashboards display flat test lists anyway.

**3. CLI `--format` flag is additive, `--json` preserved as shorthand**

`--json` continues to work identically. `--format` accepts `text|json|sarif|junit`. When both are passed (unlikely), `--format` wins. This is fully backwards compatible.

**4. No new dependencies**

Both SARIF (JSON) and JUnit (XML) output are generated with string templates. XML escaping is handled with a simple helper. No npm packages needed.

## Risks / Trade-offs

- [SARIF validation] The output may fail strict SARIF schema validation on edge cases (e.g., missing optional fields). → Mitigation: Document that output targets GitHub code scanning's ingestion requirements, not full schema compliance.
- [JUnit tooling variance] Different CI systems parse JUnit XML with slight variations. → Mitigation: Use the most common structure (Apache Ant JUnit format) which all major platforms support.
- [CLI flag proliferation] Adding `--format` alongside `--json` adds surface area. → Mitigation: `--json` is documented as deprecated shorthand but continues working.
