# Offline regression tests

Run `npm test` from the repository root with Node.js 22+.

`cache.test.mjs` loads only the unmodified production library through the existing
`tests/runner.cjs` helper, with an injectable, size-limited cache backing store.
It checks incremental writes, cross-request reads, stale-result clearing,
eviction, and quota errors. The oversized-report case characterizes a known
production limitation; it does not claim that the live-project adapter fixes it.

`live.test.mjs` executes the real built library and imported synchronous suites
in fresh VM contexts for each simulated Apps Script request. Service doubles
enforce cache value limits and cover run isolation, chunk loss, the browser
report, and optional forced failures.

`workflow.test.mjs` covers result validation, bounded polling, project safeguards,
and command failures. It also invokes the real shell entry point in a temporary
fixture with fake clasp/wget executables, so it cannot deploy to Google.

The existing `tests/html-service.cjs` helper renders the real HTML templates in
these tests. `npm run test:all` additionally runs the existing Chromium suite.
No repository formatter, linter, or type checker is configured. A real
`npm run test:live` is still needed to verify Google authorization, deployment,
and Apps Script behavior.
