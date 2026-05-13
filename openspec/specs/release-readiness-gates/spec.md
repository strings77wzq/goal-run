## Purpose

Define the local and CI gates required before publishing GoalRun packages, including version consistency, formatting, typecheck, lint, tests, build, pack smoke, and dist-tag validation.

## Requirements

### Requirement: Release check matches documented checklist

The system SHALL provide a local release check that verifies formatting, package version consistency, typecheck, lint, tests, and build before any publish command is run.

#### Scenario: Release check blocks format drift

- **WHEN** `pnpm release:check` is run
- **THEN** formatting is checked for repository-owned source and config files without scanning local runtime state

#### Scenario: Release check blocks version drift

- **WHEN** workspace package versions do not all match
- **THEN** the version consistency step fails before publish

### Requirement: Pack smoke is package-scoped

The system SHALL pack only publishable packages under `packages/` during release pack smoke checks.

#### Scenario: Workspace root is not packed

- **WHEN** `pnpm release:pack` is run
- **THEN** the private workspace root is not packed or included as a release artifact

#### Scenario: Publishable packages are packed

- **WHEN** `pnpm release:pack` is run after a successful build
- **THEN** each publishable package under `packages/` produces a tarball in a temporary pack directory

### Requirement: Release workflow is manually gated

The system SHALL publish npm packages only through a manual GitHub Actions workflow or an explicit local publish command with credentials.

#### Scenario: Latest publish requires confirmation

- **WHEN** the release workflow is requested with the `latest` npm tag
- **THEN** the workflow requires an explicit confirmation value before publish steps can run

#### Scenario: Alpha publish uses provenance

- **WHEN** the release workflow publishes alpha packages
- **THEN** it runs release checks and uses npm provenance permissions with an npm token

### Requirement: Dist-tag drift is detectable

The system SHALL provide an executable read-only command to compare npm dist-tags against the intended package version after publish and fail on drift.

#### Scenario: Dist-tag validation reports drift

- **WHEN** a package dist-tag does not point to the expected version
- **THEN** the validation command exits non-zero and reports the package, tag, expected version, and actual version

### Requirement: Local publish commands run release gates

The system SHALL gate local publish scripts behind release check, pack smoke, and install smoke before invoking any npm publish command.

#### Scenario: Alpha publish is preflighted

- **WHEN** `pnpm release:alpha` is run locally
- **THEN** release check, pack smoke, and install smoke complete before any publish command is invoked

#### Scenario: Latest publish is not implicit

- **WHEN** `pnpm release:latest` is run locally
- **THEN** the command refuses to publish implicitly and prints the explicit checked publish command that must be run intentionally
