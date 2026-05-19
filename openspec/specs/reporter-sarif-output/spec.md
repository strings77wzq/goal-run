## ADDED Requirements

### Requirement: SARIF v2.1.0 output

The system SHALL produce valid SARIF v2.1.0 JSON output from an array of diagnostics.

#### Scenario: Single error diagnostic produces SARIF with one result

- **WHEN** `formatSarif()` is called with one error diagnostic `{ code: "E001", severity: "error", message: "broken", file: "a.ts" }`
- **THEN** the output is valid JSON parseable as a SARIF v2.1.0 document with one result in `runs[0].results`

#### Scenario: Empty diagnostics produce SARIF with zero results

- **WHEN** `formatSarif()` is called with an empty array
- **THEN** the output contains `runs[0].results` as an empty array and `summary.errors` is 0

#### Scenario: Multiple severities populate correct SARIF levels

- **WHEN** `formatSarif()` is called with one error, one warning, and one info diagnostic
- **THEN** SARIF `results` entries have `level` values "error", "warning", and "note" respectively

#### Scenario: Each unique diagnostic code becomes a reportingDescriptor

- **WHEN** `formatSarif()` is called with two diagnostics sharing the same code
- **THEN** `tool.driver.rules` contains exactly one entry for that code

#### Scenario: SARIF document includes tool metadata

- **WHEN** `formatSarif()` is called
- **THEN** the output contains `tool.driver.name` set to "goalrun" and `tool.driver.informationUri` set to the project repository URL
