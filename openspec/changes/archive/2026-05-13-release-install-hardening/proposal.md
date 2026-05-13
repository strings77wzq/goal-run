## Why

GoalRun cannot be treated as "installable and release-ready" while the local release gate fails on ignored runtime state, the package scripts omit version checks, `release:pack` is broken, and npm dist-tags can drift from the repository version. This change hardens the release/install workflow so alpha users and AI agents get a reproducible CLI package instead of depending on source checkout assumptions.

## What Changes

- Add release readiness gates that ignore local runtime state, verify all workspace package versions, and make `release:check` match the documented checklist.
- Replace the broken `release:pack` command with a safe package-scoped pack smoke that cannot accidentally pack the private workspace root.
- Add an install smoke command that packs the publishable packages, installs the CLI tarball into a temporary project, and invokes the installed `goalrun` binary without publishing to npm.
- Add a GitHub Actions release workflow for credential-gated npm publish, with provenance and explicit latest-tag confirmation.
- Add executable npm dist-tag verification so tag drift fails after publish without requiring local dist-tag mutation.
- Harden local publish scripts so they run the same release gates and install smoke before any explicit local publish command.
- Make OpenSpec baseline specs trackable in git while keeping local OMX/runtime state ignored.
- Update the reusable GoalRun GitHub Action template so consumer projects install a pinned GoalRun CLI instead of relying on unqualified `npx goalrun`.

## Capabilities

### New Capabilities

- `release-readiness-gates`: Defines local and CI gates required before publishing GoalRun packages.
- `install-smoke-contract`: Defines how GoalRun proves the CLI package can be installed and invoked without publishing.
- `spec-baseline-tracking`: Defines how OpenSpec specs and change artifacts are retained as versioned project governance assets.

### Modified Capabilities

- `runtime-handoff-contract`: Preserve the previously completed handoff contract as a tracked baseline spec.
- `workflow-reliability-hardening`: Preserve the previously completed workflow reliability contract as a tracked baseline spec.

## Impact

- Affected files: root `package.json`, release scripts under `scripts/`, `.prettierignore`, `.gitignore`, GitHub workflows, GoalRun Action template, OpenSpec specs and change artifacts.
- Affected commands: `pnpm release:check`, `pnpm release:pack`, new install/dist-tag validation scripts.
- Affected CI/CD: existing CI remains non-publishing; new release workflow is manual and credential-gated.
- Security: no npm publish or dist-tag mutation is executed locally; publish steps require GitHub Actions secrets and explicit workflow inputs.
