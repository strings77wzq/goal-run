## ADDED Requirements

### Requirement: JUnit XML output

The system SHALL produce valid JUnit XML output from an array of diagnostics.

#### Scenario: Single error diagnostic produces JUnit with one failing test case

- **WHEN** `formatJunit()` is called with one error diagnostic
- **THEN** the output is valid XML with a `<testsuite>` containing one `<testcase>` with a `<failure>` child element

#### Scenario: Empty diagnostics produce JUnit with zero test cases

- **WHEN** `formatJunit()` is called with an empty array
- **THEN** the output contains `<testsuite tests="0">` with no `<testcase>` elements

#### Scenario: Warning diagnostic becomes skipped test case

- **WHEN** `formatJunit()` is called with one warning diagnostic
- **THEN** the `<testcase>` element contains a `<skipped>` child element with the diagnostic message

#### Scenario: Info diagnostic becomes passing test case

- **WHEN** `formatJunit()` is called with one info diagnostic
- **THEN** the `<testcase>` element has no failure or skipped children

#### Scenario: Test suite includes correct counts

- **WHEN** `formatJunit()` is called with two errors, one warning, and one info
- **THEN** `<testsuite>` attributes include `tests="4"`, `failures="2"`, and `skipped="1"`

#### Scenario: XML special characters are escaped

- **WHEN** `formatJunit()` is called with a diagnostic whose message contains `<`, `>`, `&`, `"`, or `'`
- **THEN** those characters are replaced with their XML entity equivalents in the output
