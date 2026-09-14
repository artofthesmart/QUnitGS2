# Testing guide

## Start here

Use Node.js 22 or later. Run commands from the **repository root**, where
`package.json` lives, not from `tests/` or `scripts/`.

```sh
npm ci
npm test
```

This is the safe starting point: no Google login, deployment configuration, or
remote project is needed. Installing dependencies prepares the browser and live
tools too; the Node tests themselves use only built-in Node modules.

| Command | What it does | Changes a Google project? |
| --- | --- | --- |
| `npm test` | Runs Node regressions, including simulated deployment workflows | No |
| `npm run test:browser` | Runs Chromium checks after [browser setup](#browser-integration-tests) | No |
| `npm run test:all` | Runs both local suites, as CI does | No |
| `npm run build` | Writes the standalone test project to ignored `dist/live` | No |
| `npm run test:live` | Builds, pushes, redeploys, and fetches real Google results | **Yes: the configured test project** |

For live testing, complete the [numbered setup](live/README.md#one-time-setup)
first. In particular, `.live-test.json` must exist at the root of **this
checkout**. It is ignored by Git, so another checkout's successful run or a
merged PR does not configure this one.

## What the tests cover

`node --test tests/*.test.cjs` runs just the top-level collection, HTML,
documentation, and result-state tests.

`live/` owns the consolidated Apps Script test project and imported QUnit cases.
`local/` adds offline build, run/result protocol, and clasp/wget workflow
regressions using service and command doubles. It also tests the unmodified
production cache path, including its known oversized-report error, separately
from the live project's chunked adapter. See [live setup](live/README.md)
for the separate `npm run test:live` command; it is never run by offline CI.

The collection tests load the bundled QUnit engine and Apps Script wrapper in an
isolated VM with an in-memory CacheService substitute. Every suite must finish,
record each assertion, retain a subsequent passing test, and produce totals
matching the individual test records. Cases cover test/hook exceptions,
assert.throws, QUnit-generated failures, and the comparison value types affected
by diff normalization.

Documentation tests follow the homepage to the complete quick start and execute
the README runner, the failing/fixed/extended tutorial, and the how-to examples
in separate consumer and library VMs. They check exact test/assertion counts,
module filtering, spreadsheet adapters, private routing, and the public result
bridge. They also check local Grav page links, heading anchors, media, and basic
page structure without installing Grav. Run just these checks with
`node --test tests/documentation.test.cjs`.

HTML tests exercise `getHtml()` and its configuration/template bindings.

Result-state tests evaluate the browser's record validation function without a
DOM. They check real bundled-QUnit payloads (including skipped/todo/zero-assertion
tests) and corrupted or partial copies; they do not replace browser rendering
coverage. `runner.cjs` owns collection, `html-service.cjs` owns limited template
evaluation, and `browser.cjs` shares process isolation and browser delivery setup.

## Browser integration tests

Install the development-only browser test dependency and Chromium:

```sh
npm ci
npx playwright install chromium
npm run test:all
```

`npm run test:browser` runs just the browser tests. These use the actual HTML
templates and browser script through `getHtml()`, with an HtmlService substitute
that supports only the printing expressions used by the library (not Google's
full template engine or contextual escaping rules). A stub of
`google.script.run` asynchronously delivers results collected by the real
bundled engine and wrapper. External requests, including the QUnit stylesheet,
are blocked; no Google project or network service is used.

Collection runs in a separate Node process so Playwright's stack formatter does
not interfere with the bundled QUnit engine's stack-source detection.

The browser checks cover visible exception messages, literal message text,
stack traces, hook failures, subsequent tests, totals, and existing collapse and
filter class toggles. Result-state checks also hold the bridge unresolved to
inspect loading, inject unavailable/malformed/partial responses and transport
errors, force a rendering failure after a usable row, and check that only
verified completion displays suite totals. They assert literal values/sources
while retaining generated diff elements and neutral zero-assertion completion.
They do not validate the external stylesheet's appearance.

Neither the original collection nor browser suite simulates Google's deployment,
library binding, cache quotas, or runtime scheduling. The new `local/` tests
model cache-entry limits and Promise scheduling but still substitute Google
services. Deployed [live tests](live/README.md) are needed for those boundaries.
The pending opt-in exception suite and verifier in
[artofthesmart/QUnitGS2-Test#4](https://github.com/artofthesmart/QUnitGS2-Test/pull/4)
have not been imported; `?suite=exceptions` is not supported by this live runner.

GitHub Actions runs `npm run test:all` on Node.js 22 and 24 for pull requests and
pushes to master. Passing local or CI checks does not publish the library or
update a consumer's selected Apps Script library version.
