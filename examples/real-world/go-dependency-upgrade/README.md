# Real-World Example: Go Dependency Upgrade

## Scenario

Upgrade `gin-gonic/gin` from v1.8 to v1.10. Breaking changes in middleware API.
Agent runs `go get -u` and says "done" — but:

- Build breaks on 3 internal packages
- One deprecated function replaced without checking callers
- Tests skipped "because they take too long"

## Without GoalRun

- ❌ Build broken on 3 packages
- ❌ Deprecated API changed behavior silently
- ❌ Tests skipped — no evidence

## With GoalRun

- ✅ `go build ./...` in verification caught the build break
- ✅ `go test ./...` forced test execution
- ✅ Criteria "all endpoints respond 200" forced smoke testing
- ✅ Full audit trail: which checkpoints were hit, which criteria passed

## The goal.yaml

See [goal.yaml](goal.yaml)
