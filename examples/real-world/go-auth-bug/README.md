# Real-World Example: Go Auth Bug

## Scenario

A Go HTTP service has a JWT session bug: users are logged out after 5 minutes instead of 30 minutes. An AI agent claims "done" after changing one line, but:

- No regression test was added
- The agent also changed a public error type (API break)
- The agent didn't run `go vet`

## Without GoalRun

Agent output: "Fixed the timeout. Done."

What was missed:

- ❌ No test for the timeout fix
- ❌ Public API change not flagged
- ❌ `go vet` not run — dead code left behind
- ❌ No evidence that tests actually passed

## With GoalRun

```bash
goalrun run .goalrun/goals/fix-jwt-timeout.yaml --supervised --loop
goalrun advance <run-id>
```

GoalRun caught:

- ✅ Criteria enforced: "regression test added" → agent had to write one
- ✅ Policy gate hit: `changes_public_api` → human approved before proceeding
- ✅ Verification ran: `go vet ./...` → dead code caught
- ✅ Audit trail: 3 checkpoints, PR-ready report

## The goal.yaml

See [goal.yaml](goal.yaml)
