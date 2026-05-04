# Security Policy

## Threat Model

GoalRun is a CLI verification harness. It reads goal specs, skill files, policy configs, and run state. It writes scaffold files, run artifacts, and lockfiles within the project root. It never executes user code, never calls external APIs, and never runs autonomously.

**GoalRun protects against:**

- Skills containing secrets or dangerous commands reaching an AI agent
- Vague or unverifiable goals being used as engineering contracts
- Policy violations (blocked shell commands, unauthorized actions)
- Path traversal writes outside the project root

**GoalRun does NOT protect against:**

- A human manually running dangerous commands
- An AI agent ignoring policy gates in the prompt
- Malicious input in goal.yaml or SKILL.md (goal authors are trusted)
- Supply chain attacks in npm dependencies (use lockfile + npm audit)
- Runtime sandboxing of AI agent operations

## Static Checks (Best-Effort)

All GoalRun security checks are **static and best-effort**:

| Check            | Type                   | Limitation                                     |
| ---------------- | ---------------------- | ---------------------------------------------- |
| Secret scan      | Regex pattern matching | Cannot detect encoded/obfuscated secrets       |
| Blocked commands | Substring matching     | Can be evaded with creative syntax             |
| Prompt injection | Pattern matching       | Novel attacks may not match known patterns     |
| External URLs    | Domain allowlist       | Legitimate URLs may be flagged                 |
| Path traversal   | Runtime validation     | Only enforced on GoalRun's own file operations |

## Reporting a Vulnerability

If you find a security vulnerability in GoalRun itself:

1. Do NOT open a public issue
2. Email the maintainer or use GitHub's private vulnerability reporting
3. Include a minimal reproduction

## Supported Versions

| Version       | Status                                        |
| ------------- | --------------------------------------------- |
| 0.1.0-alpha.1 | Alpha — stability and security not guaranteed |
