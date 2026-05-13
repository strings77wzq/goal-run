## ADDED Requirements

### Requirement: Packed CLI is installable

The system SHALL provide an install smoke check that installs the packed GoalRun CLI tarball into a temporary project and invokes the installed `goalrun` binary.

#### Scenario: Installed CLI version matches package metadata

- **WHEN** the install smoke check runs after build
- **THEN** the installed `goalrun --version` command returns the version from `packages/cli/package.json`

#### Scenario: Install smoke uses packed artifact

- **WHEN** the install smoke check runs
- **THEN** the CLI package is installed from the local packed tarball rather than from the npm registry

### Requirement: Packed CLI contains only publishable files

The system SHALL verify that the CLI tarball contains package metadata and build output without source tree runtime state.

#### Scenario: CLI tarball excludes runtime state

- **WHEN** the install smoke check inspects the packed CLI tarball
- **THEN** files under `.omx/`, `.goalrun/runs/`, `node_modules/`, and source-only test directories are absent

### Requirement: Consumer CI template installs a deterministic GoalRun CLI

The system SHALL provide a reusable GitHub Action template that installs a deterministic GoalRun CLI package before running GoalRun checks.

#### Scenario: Template avoids unqualified npx

- **WHEN** a consumer project uses the GoalRun GitHub Action template
- **THEN** GoalRun commands are run through an explicitly installed `goalrun@alpha` package or configured version instead of unqualified `npx goalrun`
