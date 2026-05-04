# Real-World Example: Go API Refactor

## Scenario

Refactor a Go REST API handler from a monolithic function into a service layer. 8-12 files affected, high blast radius.

Agent goes off-script: refactors 25 files, changes 3 public function signatures without realizing they're exported.

## Without GoalRun

- ❌ 25 files changed (budget was 12)
- ❌ 3 public API breaks undetected
- ❌ No rollback plan

## With GoalRun

- ✅ `max_changed_files: 12` caught the scope creep
- ✅ `changes_public_api` policy gate fired — human reviewed
- ✅ `go test ./...` verified no regressions
- ✅ Audit report shows exactly what was approved

## The goal.yaml

See [goal.yaml](goal.yaml)
