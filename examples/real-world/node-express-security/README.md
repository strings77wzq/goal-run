# Real-World Example: Express Security Fix

## Scenario

An Express.js app has a NoSQL injection vulnerability in the `/api/search` endpoint.
The agent writes a fix but:

- Changes the query response format (API break)
- Doesn't add a security regression test
- Wants to publish a new npm version without review

## Without GoalRun

- ❌ API break undetected (response shape changed)
- ❌ No security regression test
- ❌ `npm publish` in verification commands would have been blocked

## With GoalRun

- ✅ `changes_public_api` gate caught the response format change
- ✅ Criteria "security regression test added" forced a test
- ✅ `npm publish` blocked by policy — human must approve
- ✅ PR-ready audit report for security review

## The goal.yaml

See [goal.yaml](goal.yaml)
