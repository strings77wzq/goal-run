---
name: code-review
description: Review code changes for correctness, test coverage, security, performance, and maintainability
version: '1.0.0'
risk: low
permissions:
  - read_files
when_to_use: |
  Use after implementing a change, before merging a PR, or whenever you need
  an independent quality assessment of code changes.
when_not_to_use: |
  Do not use as a replacement for human code review on critical paths.
  Do not use for changes that have not been tested.
---

# Code Review

Perform a structured review of code changes against quality dimensions.

## Workflow

1. **Understand the change**
   - Read the goal specification and implementation strategy
   - Review the diff to understand what changed and why
   - Run the test suite to confirm tests pass

2. **Review dimensions**

   a. **Correctness**
   - Does the change correctly implement the goal?
   - Are edge cases handled?
   - Is error handling appropriate?
   - Are there any off-by-one errors, null reference risks, or race conditions?

   b. **Test Gaps**
   - Does the change include adequate tests?
   - Are edge cases tested?
   - Are negative paths tested? (what happens on failure?)
   - Is there test coverage for rollback/recovery?

   c. **Security**
   - Does the change introduce any OWASP Top 10 vulnerabilities?
   - Are there injection risks (SQL, command, path)?
   - Are secrets or credentials exposed?
   - Is input validated at system boundaries?

   d. **Performance**
   - Are there obvious performance issues (N+1 queries, large allocations)?
   - Is the algorithmic complexity appropriate for the data scale?
   - Are there blocking operations that could be async?

   e. **Maintainability**
   - Is the code clear and self-documenting?
   - Are names descriptive and consistent with the codebase?
   - Is there unnecessary abstraction or duplication?
   - Will a future developer understand this code?

   f. **Observability**
   - Are errors logged with enough context to debug?
   - Are important state transitions observable?

   g. **API Compatibility**
   - Are public APIs changed? If so, is the change backward-compatible?
   - Are deprecations properly signaled?

3. **Produce review report**
   - Summary: APPROVED / CHANGES REQUESTED / BLOCKED
   - Per-dimension findings with severity (error/warning/info)
   - Specific file:line references for each finding
   - Recommendations for each issue

## Required Outputs

- Review report with all dimensions assessed
- An overall verdict: APPROVED, CHANGES REQUESTED, or BLOCKED
- For each finding: severity, location, and recommendation

## Verification Expectations

- Every finding must reference a specific file and line
- BLOCKED verdict requires at least one error-level finding
- APPROVED verdict means no error-level findings
- Security findings are always at least warning severity

## Safety Notes

- This skill only reads files. It does not modify code.
- If a security vulnerability is found, mark it as error severity.
- Do not approve changes that delete or weaken existing tests.
- If tests are missing for the changed behavior, request changes.
