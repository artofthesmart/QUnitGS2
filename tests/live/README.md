# Live Apps Script tests

This directory replaces the separate
[`artofthesmart/QUnitGS2-Test`](https://github.com/artofthesmart/QUnitGS2-Test)
source repository. The `test/` files and MIT license were imported unchanged from
commit `5a8a825e1a03cc3dbe2326c3581dc5f59e3c59f3`. This is a source snapshot, not a
merge of that repository's Git history. The old repository and Google projects
are not modified by the import.

The pending exception suite and verifier in
[artofthesmart/QUnitGS2-Test#4](https://github.com/artofthesmart/QUnitGS2-Test/pull/4)
are not part of that master snapshot and have not been imported.
`?suite=exceptions` is not supported here. The library's existing offline
exception tests remain in `tests/*.test.cjs`.

`Code.gs` is the maintained web-app entry point. The build combines the current
root library and templates with this directory's sources and manifest, without
a published-library dependency. Do not edit the generated `dist/live` files.

## One-time setup

1. Install Node.js 22+ and GNU wget (`brew install wget` on macOS), then run
   `npm ci`, `npx clasp login`, and enable the
   [Apps Script API](https://script.google.com/home/usersettings).
2. Choose a **dedicated, disposable test Apps Script project**. You may reuse the
   original test project if you own it:
   `1cmwYQ6H7k6v3xNoFhhcASR8K2_JBJcgJ2W0WFNE8Sy3fAJzfE2Kpbh_M`.
   Back up remote-only changes first: clasp push replaces the remote files with
   the built project. Never use a production project's ID.
3. In that project's Apps Script editor, create or select a **Web app**
   deployment under **Deploy > Manage deployments**. It must execute as **Me**
   and allow **Anyone**, including users not signed into Google. Complete any
   owner authorization prompts. Workspace policies may prohibit this access.
4. Copy `.live-test.example.json` to `.live-test.json` at the repository root.
   Set `scriptId` to the ID from **Project Settings**, and `deploymentId` to the
   web-app deployment's `AKfy...` ID (not the script ID or the full URL).

Then run:

```sh
npm run test:live
```

The equivalent shell command is `bash scripts/test-live.sh`. It builds locally,
pushes with clasp, creates a version and updates the configured deployment,
starts the tests with wget, and fetches their results. **Push alone does not
update an `/exec` deployment**, which is why redeployment is included.
The root library manifest and published library deployment are untouched.

Results are saved to ignored `dist/live-results.json`; `dist/build.json` records
the build ID. Each response must match both that ID and a fresh run ID. A zero
exit code means completed, nonempty, internally consistent results with no
failed assertions. All command, network, access, and test failures exit nonzero.
After an interrupted command, remove the empty `.live-test.lock` directory only
after confirming no test command is still running.

Each run creates an Apps Script version. Periodically manage old versions in
the test project before reaching Google's version quota; the script never
deletes remote versions automatically.

## Managing test cases

The default registration list in `runLiveTests_` runs `deepEqual`, `dump`, and
`utilities`, matching the original project's supported synchronous suites.
Edit or add `.gs` files beneath `test/` and register new suite functions in that
list. The build discovers nested `.gs` files automatically.

`dev` intentionally fails and is excluded from automated runs. Open the web-app
URL with `?demo=failures` to exercise failure rendering. The ordinary `/exec`
page retains the browser test report, now without forced failures by default.
The archived async, promise, timeout, and other disabled suites remain available
in source; they are not claimed as passing or supported. Apps Script has no
timer/event-loop support equivalent to a browser.

## Results and access boundary

The JSON protocol uses `format=json`, `buildId`, `runId`, and either
`action=run` or `action=results`. A run request returns `status: "running"`;
QUnit's Promise callbacks complete after the synchronous request handler returns.
The second request returns `status: "complete"`, the QUnit `summary`, and
per-test `tests` with assertions. Unavailable/evicted results return `"pending"`;
invalid requests return `"error"` with an explanation.

Only the test project replaces the library's internal cache handle with an
adapter. It accumulates results in memory during execution, then stores chunks
below Google's 100 KB per-entry limit after QUnit's completion callback.
JSON results are isolated by build and run ID and expire after ten minutes
(Google can evict them earlier). The browser RPC reads the latest browser run.
The command uses bounded polling and never treats missing results as passing.

This adapter is test infrastructure, not a production cache fix. A passing live
run verifies the engine, collector, and deployed test project, but cannot prove
that a consumer using the library's original single-entry cache will handle
equally large reports. Separate [production-cache regressions](../local/cache.test.mjs)
exercise the unmodified path and explicitly retain its oversized-report error
as a known limitation. Changing the production cache is outside this import.

**This endpoint is public and runs as its owner.** Anyone with its URL can run
tests, consume project quotas, and read test output; run IDs are correlation
identifiers, not authentication. Keep these tests free of secrets, private data,
destructive operations, and privileged production access. Do not add tests that
touch real user data to this public runner. Google policy or sign-in pages are
reported as errors, not bypassed.
