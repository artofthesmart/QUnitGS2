# Regression tests

Run `node --test tests/*.test.cjs` with Node.js 22 or later. No packages are required.

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

Neither suite simulates Google's deployment, library binding, cache quotas, or
runtime scheduling. Deployed Apps Script smoke tests in
[QUnitGS2-Test](https://github.com/artofthesmart/QUnitGS2-Test) are still needed
for those boundaries.

GitHub Actions runs `npm run test:all` on Node.js 22 and 24 for pull requests and
pushes to master. Passing local or CI checks does not publish the library or
update a consumer's selected Apps Script library version.
