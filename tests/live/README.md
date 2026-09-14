# Live Apps Script tests

Use this workflow to test the current checkout on Google's servers. Unlike
`npm test`, **it overwrites the configured test project's source and updates its
web-app deployment**. Use only a dedicated test project you are authorized to
change. It does not publish the production library.

For checks that need no Google account, start with the
[local testing guide](../README.md). All shell commands below run from the
**repository root**, the directory containing `package.json`.

## One-time setup

### 1. Install the tools in this checkout

Install Node.js 22+ and GNU wget using your operating system's package manager
(`brew install wget` on macOS). Then:

```sh
npm ci
wget --version
```

`npm ci` installs the pinned clasp CLI locally; no global clasp install is needed.
Repeat it in a new checkout and when the dependency lockfile changes.

### 2. Sign into Google with clasp

```sh
npx clasp login
npx clasp show-authorized-user
```

Complete sign-in in the browser using an account that can edit your test project.
Enable the [Apps Script API](https://script.google.com/home/usersettings) for
that account.

The default clasp login is stored outside the repository in `~/.clasprc.json`.
Checkouts using the same operating-system user normally share it; you do not
need to sign in again just because you created another worktree. Never copy
OAuth tokens or that credential file into the repository or a commit.

### 3. Choose the test project and web-app deployment

Choose a **dedicated, disposable Apps Script project** that you own or are
authorized to deploy. Back up remote-only changes first: clasp push replaces
the remote files with the built project. Never use a production project's ID.

In the Apps Script editor, create or select a **Web app** deployment under
**Deploy > Manage deployments** (use **New deployment** for a new one). It must
execute as **Me** and allow **Anyone**, including users not signed into Google.
Complete any owner authorization prompts. Workspace policies may prohibit
this access; do not bypass them. See Google's
[web-app deployment instructions](https://developers.google.com/apps-script/guides/web#deploy_a_script_as_a_web_app)
if you are creating a new test project.

You need two different identifiers:

| Configuration field | Where to find it |
| --- | --- |
| `scriptId` | **Project Settings > Script ID** in the test project |
| `deploymentId` | The web app's **Deployment ID** in **Manage deployments**; the `AKfy...` part of its `/exec` URL |

Do not substitute the production library ID, a version number, the full web-app
URL, or the editor-only `/dev` URL.

### 4. Create the local configuration in this checkout

If `.live-test.json` does not already exist, copy the template at the repository
root:

```sh
cp .live-test.example.json .live-test.json
```

Open `.live-test.json` in your editor and replace **both** placeholder values
with the identifiers from step 3. Save it beside `package.json`, **not** inside
`scripts/` or `tests/live/`.

Maintainers authorized to update this repository's existing shared test app can
use the following contents. Other contributors should use their own test
project's IDs instead:

```json
{
  "scriptId": "1cmwYQ6H7k6v3xNoFhhcASR8K2_JBJcgJ2W0WFNE8Sy3fAJzfE2Kpbh_M",
  "deploymentId": "AKfycbxGNuNyR-pec75X_whqf56rkoi8-8ne5aeK8bdctR-uyq5Wjwht"
}
```

These are project identifiers, **not login credentials**. The configuration is
still deliberately ignored by Git so each checkout explicitly selects its
deployment target. Commit neither `.live-test.json` nor clasp credentials.

**Repeat this configuration step for every clone or worktree.** A Git pull or
merge brings in the template, not the ignored `.live-test.json`. A file created
in an agent's isolated worktree does not appear in your main checkout.

## Every test run

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
A successful run ends with a line like `327/327 assertions passed; 0 failed`;
the counts can change as tests are added.

Each run creates an Apps Script version. Periodically manage old versions in
the test project before reaching Google's version quota; the script never
deletes remote versions automatically.

## View the results in a browser

Open the configured web app's `/exec` URL. Maintainers' shared test report is
available at [the QUnitGS2 live test app](https://script.google.com/macros/s/AKfycbxGNuNyR-pec75X_whqf56rkoi8-8ne5aeK8bdctR-uyq5Wjwht/exec).
Opening the page runs a fresh suite and displays its results; it is not a static
copy of the npm command's last report. No Google sign-in is needed to view a
correctly configured public test app.

Visiting that URL **does not deploy your local changes**. Run `npm run test:live`
first to update the test project from this checkout. A repository merge alone
does not change the hosted code.

## Troubleshooting setup

| Symptom | What to check |
| --- | --- |
| `Copy .live-test.example.json to .live-test.json and configure the test project first.` | Follow step 4 in this checkout's root. Changing into `scripts/` will not help: the script always reads the repository-root configuration. |
| An error mentions `node_modules/.bin/clasp` or a missing dependency | Run `npm ci` in this checkout. |
| An error mentions missing `wget` | Install GNU wget and check `wget --version`. |
| Not logged in, permission denied, or Apps Script API disabled | Check `npx clasp show-authorized-user`, the account's API setting, and access to the chosen project. Sign in again if needed. |
| Expected JSON, but received a sign-in or error page | Check the deployment ID, **Web app** type, **Me** execution identity, anonymous **Anyone** access, and any owner authorization prompts. |
| Timed out waiting for completed results | Inspect **Executions** in the test project for errors. Unsupported async tests or evicted cached results cannot count as success. |
| A live-test command is already running | Wait for it to finish. If it was interrupted and no run is active, remove only the empty lock directory with `rmdir .live-test.lock` from the root. |

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

## Source and deployment boundaries

This directory replaces the separate
[`artofthesmart/QUnitGS2-Test`](https://github.com/artofthesmart/QUnitGS2-Test)
source repository. The `test/` files and MIT license were imported unchanged from
commit `5a8a825e1a03cc3dbe2326c3581dc5f59e3c59f3`. This is a source snapshot, not a
merge of that repository's Git history. Importing the files does not change the
old repository or deploy a Google project.

The pending exception suite and verifier in
[artofthesmart/QUnitGS2-Test#4](https://github.com/artofthesmart/QUnitGS2-Test/pull/4)
are not part of that master snapshot and have not been imported.
`?suite=exceptions` is not supported here. The library's existing offline
exception tests remain in `tests/*.test.cjs`.

`Code.gs` is the maintained web-app entry point. The build combines the current
root library and templates with this directory's sources and manifest, without
a published-library dependency. Do not edit the generated `dist/live` files.

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
