# Changelog

Notable changes to QUnitGS2 are documented here.

## Result-state reliability - 2026-09-14

### Fixed

- Replaced the initial passing banner and empty completion totals with a neutral
  loading message. Completed suites now explicitly display pass or fail styling;
  an explicit zero-assertion completion remains neutral.
- Made unavailable payloads, invalid JSON, bridge failures, and rendering errors
  visible without leaving stale passing indicators or unverified suite totals.
- Checked result records, assertion outcomes, identifiers, and counts before
  reporting suite completion. Missing summaries and inconsistent records now
  show an incomplete warning while retaining usable test rows; unfinished test
  counts describe recovered assertions, not successful completion.
- Rendered assertion messages, expected/actual values, stack sources, and runtime
  errors as literal text, keeping generated comparison diff markup separate.
- Preserved test collapse and passed-test filtering, including the initial
  `hidepassed` configuration and visible unfinished test rows.

### Added

- Node regression coverage for result validation and real bundled-QUnit output,
  including skipped tests, expected and unexpected todo outcomes, zero-assertion
  tests, exceptions, and fields omitted during JSON serialization.
- Chromium regressions for loading before bridge resolution, completed suites,
  malformed and partial results, transport/rendering failures, safe text
  presentation, and clearing stale success indicators.

### Compatibility

The public API, cache format, and test scheduling are unchanged. The page reads
one cached response without polling or retries; it cannot establish run freshness
or repair server-side execution and cache failures. This does not resolve the
underlying scheduling/procedure questions in issues #5 and #11. Deployed Apps
Script behavior remains unverified locally; library versions are published and
selected separately from repository changes.

## Exception reporting fixes - 2026-09-14

### Fixed

- Fixed tests with uncaught exceptions disappearing from the results.
  Failures without an expected value now skip diff generation instead of
  interrupting result collection. This covers exceptions in tests and
  setup/teardown hooks, preserving subsequent tests and suite totals under
  QUnit's default exception handling.
- Normalized textual diff inputs, including explicitly undefined comparison
  values, so reporting does not throw while generating a diff.
- Displayed failed assertion messages as literal text in the results page rather
  than only showing the generic "failed" label.

Changes: [#15](https://github.com/artofthesmart/QUnitGS2/pull/15).
Issue: [#13](https://github.com/artofthesmart/QUnitGS2/issues/13).

### Added

- Local regression tests using the bundled QUnit engine, covering exception
  reporting, setup/teardown hooks, continued execution, assertion counts,
  `assert.throws`, and comparison value types.
- Five Chromium integration tests using the actual HTML templates and browser
  script, covering messages, stack traces, totals, subsequent results, and
  collapse/filter controls.
- npm commands for collection and browser tests, with setup instructions and
  testing boundaries in [tests/README.md](tests/README.md).
- Executable documentation examples, checks of the public HTML/template
  bindings, and GitHub Actions regression checks on Node.js 22 and 24.
- Website guidance on exception failures, regression suite results, and
  selecting an Apps Script library version containing the fixes. Corrected the
  tutorial's case-sensitive `QUnit` alias.
- Companion consumer integration coverage in
  [artofthesmart/QUnitGS2-Test#4](https://github.com/artofthesmart/QUnitGS2-Test/pull/4),
  with an opt-in suite containing 29 test cases and 45 assertions, including
  intentional failures whose reporting and recovery are verified.

### Compatibility

The public API is unchanged. Exception reporting uses QUnit's default exception
handling; asynchronous scheduling and the `notrycatch` option are unchanged.
Apps Script library versions are published separately from repository changes.
Existing consumers must select a version containing these fixes or use the
updated source; merging a PR does not update a pinned library version.
