# Regression tests

Run `npm test` with Node.js 22 or later. The Node regression tests require no
installed packages. `node --test tests/*.test.cjs` runs just the original
collection, HTML, and documentation tests.

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

Documentation tests execute the README, website home/quick-start connecting
code, and both stages of the tutorial with their real example snippets. HTML
tests exercise `getHtml()` and its configuration/template bindings.

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
filter class toggles. They do not validate the external stylesheet's appearance.

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
