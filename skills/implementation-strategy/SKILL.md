---
name: implementation-strategy
description: Plan implementation strategy for medium-to-high risk changes before writing code
version: "1.0.0"
risk: low
permissions:
  - read_files
when_to_use: |
  Use before making changes that affect multiple files, public APIs, data models,
  auth code, payment systems, or any change with significant blast radius.
  Also use when the best approach is unclear or multiple options exist.
when_not_to_use: |
  Do not use for trivial changes like typo fixes, documentation-only updates,
  or changes where the implementation is already clearly specified and low-risk.
---

# Implementation Strategy

Analyze a proposed change and produce a structured implementation plan before writing code.

## Workflow

1. **Understand the goal**
   - Read the goal specification, criteria, and budget
   - Identify what problem is being solved and why
   - Note any constraints from policy or verification requirements

2. **Scope the impact**
   - Identify all files likely to be affected
   - Identify public API surfaces that may change
   - Check for existing tests related to the affected areas
   - Map dependencies between components

3. **Design the approach**
   - Enumerate at least two possible approaches with trade-offs
   - Select the approach with the best balance of correctness, safety, and maintainability
   - Design the test strategy: what tests need to be added or updated
   - Plan the rollback strategy: how to revert if something goes wrong

4. **Write the strategy document**
   - Summary of the problem and proposed solution
   - List of affected files (estimated)
   - Test strategy
   - Rollback plan
   - Risk assessment (low/medium/high per component)

## Required Outputs

- A strategy document (markdown) with all sections above
- Estimated changed file count (compare against goal budget.max_changed_files)
- Test coverage plan

## Verification Expectations

- Strategy MUST be reviewed by a human before implementation begins
- Estimated file count MUST NOT exceed goal budget.max_changed_files
- All identified public API changes MUST be flagged for approval
- No implementation code should be written during this phase

## Safety Notes

- This skill only reads files and produces a plan. It does not modify code.
- If the strategy identifies risks that cannot be mitigated, stop and escalate.
- Do not proceed to implementation if the strategy is incomplete.
