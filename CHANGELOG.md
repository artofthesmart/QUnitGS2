# Changelog

Notable changes to QUnitGS2 are documented here.

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
