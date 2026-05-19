## 1. Reporter SARIF Format (TDD: tests first)

- [ ] 1.1 Write tests for `formatSarif()` covering: single error, empty array, mixed severities, dedup codes, tool metadata
- [ ] 1.2 Run tests and verify they fail (RED — function does not exist yet)
- [ ] 1.3 Implement `formatSarif()` in `packages/reporter/src/format.ts` producing valid SARIF v2.1.0 JSON
- [ ] 1.4 Run tests and verify all pass (GREEN)
- [ ] 1.5 Refactor: extract SARIF driver metadata constant, deduplicate rule generation logic

## 2. Reporter JUnit Format (TDD: tests first)

- [ ] 2.1 Write tests for `formatJunit()` covering: single error, empty array, warning as skipped, info as passing, correct counts, XML escaping
- [ ] 2.2 Run tests and verify they fail (RED — function does not exist yet)
- [ ] 2.3 Implement `formatJunit()` with XML entity escaping in `packages/reporter/src/format.ts`
- [ ] 2.4 Run tests and verify all pass (GREEN)
- [ ] 2.5 Refactor: extract XML escape helper, ensure consistent JUnit XML structure

## 3. Reporter Exports

- [ ] 3.1 Export `formatSarif` and `formatJunit` from `packages/reporter/src/index.ts`
- [ ] 3.2 Export any new types (if needed) from the reporter package

## 4. CLI `--format` Flag Integration

- [ ] 4.1 Add `--format` option to `verify`, `lint`, and `test` commands in `packages/cli/src/index.ts`
- [ ] 4.2 Implement format dispatch logic: route `text|json|sarif|junit` to the correct format function
- [ ] 4.3 Ensure `--json` flag remains as shorthand for `--format json` (backwards compatible)
- [ ] 4.4 Update CLI smoke tests to cover new `--format` flag

## 5. Verification & Cleanup

- [ ] 5.1 Run full test suite: `pnpm test` — all 297+ tests must pass
- [ ] 5.2 Run typecheck: `pnpm typecheck` — must pass
- [ ] 5.3 Run lint: `pnpm lint` — must pass
- [ ] 5.4 Run build: `pnpm build` — must succeed
- [ ] 5.5 Manually verify SARIF output roundtrips through `jq` and JUnit output through `xmllint`
