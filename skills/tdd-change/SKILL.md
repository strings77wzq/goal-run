---
name: tdd-change
description: Implement changes using strict test-driven development — red, green, refactor
version: "1.0.0"
risk: medium
permissions:
  - read_files
  - write_files
  - run_tests
when_to_use: |
  Use for bug fixes, features, and behavior-changing refactors where confidence
  in correctness is critical. Required when the goal specifies regression tests.
when_not_to_use: |
  Do not use for documentation-only changes, formatting-only changes, or changes
  where the existing test suite already provides complete coverage of the change.
---

# TDD Change

Implement code changes using the test-driven development cycle: Red, Green, Refactor.

## Workflow

1. **Understand the change**
   - Read the goal specification and implementation strategy (if provided)
   - Identify the specific behavior that needs to change
   - Understand the current behavior and expected new behavior

2. **Locate related tests**
   - Find existing tests that cover the affected code
   - Run the existing test suite to establish a baseline
   - If no tests exist for the affected behavior, note this as a test gap

3. **Write a failing test (RED)**
   - Write a test that describes the expected new behavior
   - If tests don't exist, write a test for the current behavior first, then modify it
   - Run the test to confirm it FAILS for the right reason
   - DO NOT proceed if the test passes without code changes

4. **Implement the minimal fix (GREEN)**
   - Write the smallest amount of code needed to make the failing test pass
   - Do not refactor during this step — just make it work
   - Run the specific test to confirm it passes
   - Run the broader test suite to check for regressions

5. **Refactor (REFACTOR)**
   - Clean up the implementation without changing behavior
   - Remove duplication, improve naming, simplify logic
   - Run all tests after each refactoring step
   - If tests fail, revert the last refactoring step

6. **Verify**
   - Run ALL tests, not just the targeted ones
   - Run goal verification commands (typecheck, lint)
   - Confirm no regression in unrelated tests

## Required Outputs

- The failing test (before implementation)
- The minimal implementation
- The refactored implementation (if applicable)
- Verification results: test output showing all tests pass

## Verification Expectations

- At least one new or modified test that specifically tests the change
- All existing tests continue to pass (no regressions)
- Goal verification commands all pass
- Diff is focused: no unrelated changes

## Safety Notes

- NEVER skip the RED phase. Always confirm the test fails first.
- NEVER modify tests to match broken code — fix the code, not the test.
- If a test starts passing without code changes, investigate. Something is wrong.
- Keep changes minimal. Do not refactor unrelated code.
- Stop if you cannot make the test pass within the goal's budget.max_iterations.
